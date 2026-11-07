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
