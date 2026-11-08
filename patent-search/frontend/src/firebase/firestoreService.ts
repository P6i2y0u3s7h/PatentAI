import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  deleteDoc,
  setDoc,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  SearchHistoryEntry,
  HistoryResponse,
  AssistantSession,
  AssistantHistoryResponse,
  AssistantSessionDetailResponse,
  ChatMessage,
  ComparisonHistoryEntry,
  ComparisonHistoryResponse,
  NoveltyHistoryEntry,
  NoveltyHistoryResponse,
  GenericDeleteResponse,
  DraftReviewResponse,
  DraftReviewHistoryEntry,
  DraftReviewHistoryResponse,
  PatentNetworkResponse,
  PatentNetworkHistoryEntry,
  PatentNetworkHistoryResponse,
  ClaimChartResponse,
  ClaimChartHistoryEntry,
  ClaimChartHistoryResponse,
} from '../types/patent';
import type { ResearchHistoryItem, ResearchResults } from '../api/researchApi';

/**
 * Normalizes varied timestamp formats from Cloud Firestore into standard ISO strings.
 */
function toIsoDate(val: any): string {
  if (!val) return new Date().toISOString();
  if (typeof val?.toDate === 'function') {
    return val.toDate().toISOString();
  }
  if (val?.seconds) {
    return new Date(val.seconds * 1000).toISOString();
  }
  if (typeof val === 'string') {
    return val;
  }
  return new Date().toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Search History
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch search history directly from Cloud Firestore for the authenticated user.
 */
export async function getFirestoreSearchHistory(userId: string, maxLimit = 50): Promise<HistoryResponse> {
  if (!userId) {
    return { entries: [], total: 0 };
  }

  try {
    const colRef = collection(db, 'search_history');
    // Using single-field where query to avoid composite index requirements
    const q = query(colRef, where('user_id', '==', userId), firestoreLimit(maxLimit * 2));
    const snapshot = await getDocs(q);

    const entries: SearchHistoryEntry[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      entries.push({
        id: data.id || docSnap.id,
        user_id: data.user_id || userId,
        query_snippet: data.query_snippet || '',
        top_result_title: data.top_result_title || undefined,
        top_result_score: typeof data.top_result_score === 'number' ? data.top_result_score : undefined,
        result_count: data.result_count || 0,
        created_at: toIsoDate(data.created_at),
        source: (data.source as 'text' | 'pdf') || 'text',
      });
    });

    // In-memory descending sort by timestamp
    entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const trimmed = entries.slice(0, maxLimit);
    console.info(`[PatentAI Firestore] Successfully retrieved ${trimmed.length} search entries directly from Cloud Firestore.`);
    return {
      entries: trimmed,
      total: trimmed.length,
    };
  } catch (error) {
    console.warn('[PatentAI Firestore] Direct Firestore search history error:', error);
    throw error;
  }
}

/**
 * Delete a search history entry directly from Cloud Firestore.
 */
export async function deleteFirestoreSearchHistory(entryId: string): Promise<GenericDeleteResponse> {
  try {
    const docRef = doc(db, 'search_history', entryId);
    await deleteDoc(docRef);
    console.info(`[PatentAI Firestore] Deleted search entry ${entryId} from Firestore.`);
    return { deleted_id: entryId, success: true };
  } catch (error) {
    console.warn('[PatentAI Firestore] Delete search history error:', error);
    return { deleted_id: entryId, success: false };
  }
}

/**
 * Client-side save to Cloud Firestore for resilience when backend is offline or slow.
 */
export async function saveFirestoreSearchHistory(userId: string, entry: Omit<SearchHistoryEntry, 'id'> & { id?: string }): Promise<string> {
  const entryId = entry.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `search_${Date.now()}`);
  try {
    const docRef = doc(db, 'search_history', entryId);
    await setDoc(docRef, {
      ...entry,
      id: entryId,
      user_id: userId,
      created_at: entry.created_at || new Date().toISOString(),
    });
    return entryId;
  } catch (err) {
    console.warn('[PatentAI Firestore] Could not save search entry to Firestore:', err);
    return entryId;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. AI Assistant Chats
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch assistant chat sessions directly from Cloud Firestore.
 */
export async function getFirestoreAssistantChats(userId: string, maxLimit = 30): Promise<AssistantHistoryResponse> {
  if (!userId) return { sessions: [], total: 0 };

  try {
    const colRef = collection(db, 'assistant_chats');
    const q = query(colRef, where('user_id', '==', userId), firestoreLimit(maxLimit));
    const snapshot = await getDocs(q);

    const sessions: AssistantSession[] = [];
    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      sessions.push({
        id: d.id || docSnap.id,
        user_id: d.user_id || userId,
        title: d.title || 'Untitled Session',
        doc_name: d.doc_name || undefined,
        created_at: toIsoDate(d.created_at),
        updated_at: toIsoDate(d.updated_at || d.created_at),
        message_count: d.message_count || (Array.isArray(d.messages) ? d.messages.length : 0),
        last_message: d.last_message || undefined,
      });
    });

    sessions.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    console.info(`[PatentAI Firestore] Loaded ${sessions.length} assistant chat sessions from Cloud Firestore.`);
    return { sessions, total: sessions.length };
  } catch (error) {
    console.warn('[PatentAI Firestore] Assistant chats fetch error:', error);
    return { sessions: [], total: 0 };
  }
}

/**
 * Fetch a specific chat session with its full message history.
 */
export async function getFirestoreAssistantChatDetail(chatId: string): Promise<AssistantSessionDetailResponse | null> {
  if (!chatId) return null;
  try {
    const docRef = doc(db, 'assistant_chats', chatId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;

    const d = snap.data();
    const session: AssistantSession = {
      id: d.id || snap.id,
      user_id: d.user_id || '',
      title: d.title || 'Untitled Session',
      doc_name: d.doc_name || undefined,
      created_at: toIsoDate(d.created_at),
      updated_at: toIsoDate(d.updated_at || d.created_at),
      message_count: d.message_count || (Array.isArray(d.messages) ? d.messages.length : 0),
      last_message: d.last_message || undefined,
    };

    const messages: ChatMessage[] = Array.isArray(d.messages) ? d.messages : [];
    return { session, messages };
  } catch (err) {
    console.warn(`[PatentAI Firestore] Get assistant chat detail error for ${chatId}:`, err);
    return null;
  }
}

/**
 * Delete an assistant chat session directly from Cloud Firestore.
 */
export async function deleteFirestoreAssistantChat(chatId: string): Promise<GenericDeleteResponse> {
  try {
    const docRef = doc(db, 'assistant_chats', chatId);
    await deleteDoc(docRef);
    return { deleted_id: chatId, success: true };
  } catch (error) {
    console.warn('[PatentAI Firestore] Delete assistant chat error:', error);
    return { deleted_id: chatId, success: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Patent Comparisons
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch patent comparisons directly from Cloud Firestore.
 */
export async function getFirestoreComparisonHistory(userId: string, maxLimit = 20): Promise<ComparisonHistoryResponse> {
  if (!userId) return { entries: [], total: 0 };

  try {
    const colRef = collection(db, 'patent_comparisons');
    const q = query(colRef, where('user_id', '==', userId), firestoreLimit(maxLimit));
    const snapshot = await getDocs(q);

    const items: ComparisonHistoryEntry[] = [];
    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      items.push({
        id: d.id || docSnap.id,
        user_id: d.user_id || userId,
        patent_a_id: d.patent_a_id || '',
        patent_a_title: d.patent_a_title || '',
        patent_b_id: d.patent_b_id || '',
        patent_b_title: d.patent_b_title || '',
        similarity_percentage: typeof d.similarity_percentage === 'number' ? d.similarity_percentage : 0,
        created_at: toIsoDate(d.created_at),
      });
    });

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    console.info(`[PatentAI Firestore] Loaded ${items.length} patent comparisons from Cloud Firestore.`);
    return { entries: items, total: items.length };
  } catch (error) {
    console.warn('[PatentAI Firestore] Comparison history fetch error:', error);
    return { entries: [], total: 0 };
  }
}

/**
 * Delete a patent comparison from Cloud Firestore.
 */
export async function deleteFirestoreComparison(entryId: string): Promise<GenericDeleteResponse> {
  try {
    const docRef = doc(db, 'patent_comparisons', entryId);
    await deleteDoc(docRef);
    return { deleted_id: entryId, success: true };
  } catch (error) {
    console.warn('[PatentAI Firestore] Delete comparison error:', error);
    return { deleted_id: entryId, success: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. AI Patent Research Agent History
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch research agent history directly from Cloud Firestore.
 */
export async function getFirestoreResearchHistory(userId: string, maxLimit = 20): Promise<ResearchHistoryItem[]> {
  if (!userId) return [];

  try {
    const colRef = collection(db, 'research_history');
    const q = query(colRef, where('user_id', '==', userId), firestoreLimit(maxLimit));
    const snapshot = await getDocs(q);

    const items: ResearchHistoryItem[] = [];
    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      let parsedResults: ResearchResults | undefined = undefined;
      if (d.full_data_json) {
        try {
          parsedResults = JSON.parse(d.full_data_json);
        } catch (_) {}
      }

      items.push({
        id: d.id || docSnap.id,
        user_id: d.user_id || userId,
        invention_title: d.invention_title || 'Untitled Research',
        technical_field: d.technical_field || 'Technology',
        query_count: d.query_count || 0,
        patents_found: d.patents_found || 0,
        top_similarity: d.top_similarity || 0,
        created_at: toIsoDate(d.created_at),
        summary: d.summary || '',
        full_data: parsedResults,
      });
    });

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    console.info(`[PatentAI Firestore] Loaded ${items.length} research history records from Cloud Firestore.`);
    return items;
  } catch (error) {
    console.warn('[PatentAI Firestore] Research history fetch error:', error);
    return [];
  }
}

/**
 * Fetch complete Research Results for a specific research task directly from Cloud Firestore.
 */
export async function getFirestoreResearchDetail(taskId: string): Promise<ResearchResults | null> {
  if (!taskId) return null;
  try {
    const docRef = doc(db, 'research_history', taskId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;

    const data = snap.data();
    if (data.full_data_json) {
      return JSON.parse(data.full_data_json);
    }
    return null;
  } catch (err) {
    console.warn(`[PatentAI Firestore] Get research detail error for ${taskId}:`, err);
    return null;
  }
}

/**
 * Delete a research record from Cloud Firestore.
 */
export async function deleteFirestoreResearch(taskId: string): Promise<{ success: boolean; task_id: string }> {
  try {
    const docRef = doc(db, 'research_history', taskId);
    await deleteDoc(docRef);
    return { success: true, task_id: taskId };
  } catch (error) {
    console.warn('[PatentAI Firestore] Delete research record error:', error);
    return { success: false, task_id: taskId };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Patent Novelty Analyses
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch patent novelty analysis history directly from Cloud Firestore.
 */
export async function getFirestoreNoveltyHistory(userId: string, maxLimit = 20): Promise<NoveltyHistoryResponse> {
  if (!userId) return { entries: [], total: 0 };

  try {
    const colRef = collection(db, 'patent_novelty_analyses');
    const q = query(colRef, where('user_id', '==', userId), firestoreLimit(maxLimit));
    const snapshot = await getDocs(q);

    const items: NoveltyHistoryEntry[] = [];
    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      items.push({
        id: d.id || docSnap.id,
        user_id: d.user_id || userId,
        title: d.title || 'Untitled Analysis',
        novelty_verdict: d.novelty_verdict || 'Moderate Novelty',
        highest_similarity_score: typeof d.highest_similarity_score === 'number' ? d.highest_similarity_score : 0,
        relevant_patents_count: d.relevant_patents_count || 0,
        created_at: toIsoDate(d.created_at),
      });
    });

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { entries: items, total: items.length };
  } catch (error) {
    console.warn('[PatentAI Firestore] Novelty history fetch error:', error);
    return { entries: [], total: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. AI Patent Draft Reviews
// ─────────────────────────────────────────────────────────────────────────────

export async function getFirestoreDraftReviews(userId: string, maxLimit = 20): Promise<DraftReviewHistoryResponse> {
  if (!userId) return { entries: [], total: 0 };

  try {
    const colRef = collection(db, 'draft_reviews');
    const q = query(colRef, where('user_id', '==', userId), firestoreLimit(maxLimit));
    const snapshot = await getDocs(q);

    const items: DraftReviewHistoryEntry[] = [];
    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      items.push({
        id: d.id || docSnap.id,
        user_id: d.user_id || userId,
        title: d.title || 'Untitled Draft Review',
        technical_field: d.technical_field || 'Technology',
        quality_score: typeof d.quality_score === 'number' ? d.quality_score : 0,
        issue_count: typeof d.issue_count === 'number' ? d.issue_count : (Array.isArray(d.issues) ? d.issues.length : 0),
        created_at: toIsoDate(d.created_at),
      });
    });

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { entries: items, total: items.length };
  } catch (error) {
    console.warn('[PatentAI Firestore] Draft reviews fetch error:', error);
    return { entries: [], total: 0 };
  }
}

export async function getFirestoreDraftReviewDetail(reviewId: string): Promise<DraftReviewResponse | null> {
  if (!reviewId) return null;
  try {
    const docRef = doc(db, 'draft_reviews', reviewId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    const d = snap.data();
    if (d.full_data_json) {
      return JSON.parse(d.full_data_json);
    }
    return d as DraftReviewResponse;
  } catch (err) {
    console.warn(`[PatentAI Firestore] Get draft review detail error for ${reviewId}:`, err);
    return null;
  }
}

export async function saveFirestoreDraftReview(data: DraftReviewResponse): Promise<string> {
  const id = data.id || `rev_${Date.now()}`;
  try {
    const docRef = doc(db, 'draft_reviews', id);
    await setDoc(docRef, {
      id,
      user_id: data.user_id,
      title: data.title,
      technical_field: data.technical_field,
      review_type: data.review_type,
      quality_score: data.quality_score,
      issue_count: data.issues.length,
      created_at: data.created_at,
      full_data_json: JSON.stringify(data),
    });
    return id;
  } catch (err) {
    console.warn('[PatentAI Firestore] Save draft review notice:', err);
    return id;
  }
}

export async function deleteFirestoreDraftReview(reviewId: string): Promise<GenericDeleteResponse> {
  try {
    const docRef = doc(db, 'draft_reviews', reviewId);
    await deleteDoc(docRef);
    return { deleted_id: reviewId, success: true };
  } catch (error) {
    console.warn('[PatentAI Firestore] Delete draft review error:', error);
    return { deleted_id: reviewId, success: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Interactive Patent Similarity Networks
// ─────────────────────────────────────────────────────────────────────────────

export async function getFirestorePatentNetworks(userId: string, maxLimit = 20): Promise<PatentNetworkHistoryResponse> {
  if (!userId) return { entries: [], total: 0 };

  try {
    const colRef = collection(db, 'patent_networks');
    const q = query(colRef, where('user_id', '==', userId), firestoreLimit(maxLimit));
    const snapshot = await getDocs(q);

    const items: PatentNetworkHistoryEntry[] = [];
    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      items.push({
        id: d.id || docSnap.id,
        user_id: d.user_id || userId,
        central_patent_id: d.central_patent_id || '',
        central_title: d.central_title || 'Central Patent',
        node_count: typeof d.node_count === 'number' ? d.node_count : 0,
        created_at: toIsoDate(d.created_at),
      });
    });

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { entries: items, total: items.length };
  } catch (error) {
    console.warn('[PatentAI Firestore] Patent networks fetch error:', error);
    return { entries: [], total: 0 };
  }
}

export async function getFirestorePatentNetworkDetail(networkId: string): Promise<PatentNetworkResponse | null> {
  if (!networkId) return null;
  try {
    const docRef = doc(db, 'patent_networks', networkId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    const d = snap.data();
    if (d.full_data_json) {
      return JSON.parse(d.full_data_json);
    }
    return d as PatentNetworkResponse;
  } catch (err) {
    console.warn(`[PatentAI Firestore] Get network detail error for ${networkId}:`, err);
    return null;
  }
}

export async function saveFirestorePatentNetwork(data: PatentNetworkResponse): Promise<string> {
  const id = data.id || `net_${Date.now()}`;
  try {
    const docRef = doc(db, 'patent_networks', id);
    await setDoc(docRef, {
      id,
      user_id: data.user_id,
      central_patent_id: data.central_patent_id,
      central_title: data.central_title,
      node_count: data.nodes.length,
      created_at: data.created_at,
      full_data_json: JSON.stringify(data),
    });
    return id;
  } catch (err) {
    console.warn('[PatentAI Firestore] Save patent network notice:', err);
    return id;
  }
}

export async function deleteFirestorePatentNetwork(networkId: string): Promise<GenericDeleteResponse> {
  try {
    const docRef = doc(db, 'patent_networks', networkId);
    await deleteDoc(docRef);
    return { deleted_id: networkId, success: true };
  } catch (error) {
    console.warn('[PatentAI Firestore] Delete network error:', error);
    return { deleted_id: networkId, success: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. AI Claim Charts
// ─────────────────────────────────────────────────────────────────────────────

export async function getFirestoreClaimCharts(userId: string, maxLimit = 20): Promise<ClaimChartHistoryResponse> {
  if (!userId) return { entries: [], total: 0 };

  try {
    const colRef = collection(db, 'claim_charts');
    const q = query(colRef, where('user_id', '==', userId), firestoreLimit(maxLimit));
    const snapshot = await getDocs(q);

    const items: ClaimChartHistoryEntry[] = [];
    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      items.push({
        id: d.id || docSnap.id,
        user_id: d.user_id || userId,
        title: d.title || 'Patent Claim Chart',
        doc_a_name: d.doc_a_name || 'Document A',
        doc_b_name: d.doc_b_name || 'Document B',
        coverage_score: typeof d.coverage_score === 'number' ? d.coverage_score : 0,
        total_elements: typeof d.total_elements === 'number' ? d.total_elements : 0,
        created_at: toIsoDate(d.created_at),
      });
    });

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { entries: items, total: items.length };
  } catch (error) {
    console.warn('[PatentAI Firestore] Claim charts fetch error:', error);
    return { entries: [], total: 0 };
  }
}

export async function getFirestoreClaimChartDetail(chartId: string): Promise<ClaimChartResponse | null> {
  if (!chartId) return null;
  try {
    const docRef = doc(db, 'claim_charts', chartId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    const d = snap.data();
    if (d.full_data_json) {
      return JSON.parse(d.full_data_json);
    }
    return d as ClaimChartResponse;
  } catch (err) {
    console.warn(`[PatentAI Firestore] Get claim chart detail error for ${chartId}:`, err);
    return null;
  }
}

export async function saveFirestoreClaimChart(data: ClaimChartResponse): Promise<string> {
  const id = data.id || `chart_${Date.now()}`;
  try {
    const docRef = doc(db, 'claim_charts', id);
    await setDoc(docRef, {
      id,
      user_id: data.user_id,
      title: data.title,
      doc_a_name: data.doc_a_name,
      doc_b_name: data.doc_b_name,
      coverage_score: data.coverage_score,
      total_elements: data.total_elements,
      created_at: data.created_at,
      full_data_json: JSON.stringify(data),
    });
    return id;
  } catch (err) {
    console.warn('[PatentAI Firestore] Save claim chart notice:', err);
    return id;
  }
}

export async function deleteFirestoreClaimChart(chartId: string): Promise<GenericDeleteResponse> {
  try {
    const docRef = doc(db, 'claim_charts', chartId);
    await deleteDoc(docRef);
    return { deleted_id: chartId, success: true };
  } catch (error) {
    console.warn('[PatentAI Firestore] Delete claim chart error:', error);
    return { deleted_id: chartId, success: false };
  }
}

