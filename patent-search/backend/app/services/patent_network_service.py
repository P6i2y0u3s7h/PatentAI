"""
Interactive Patent Similarity Network Service.
Constructs semantic citation & technology cluster graphs from real FAISS vectors,
computing pairwise similarity matrices, shared technical concepts, and category clusters.
"""

import logging
import re
import time
import uuid
from typing import Dict, List, Optional, Set, Tuple

import numpy as np

from app.models import (
    NetworkEdge,
    NetworkNode,
    PatentNetworkResponse,
    PatentResult,
)
from app.services import embedding_service, patent_service, search_service
from app.utils import extract_keywords

logger = logging.getLogger(__name__)

# IPC Category Mappings
IPC_CATEGORY_MAP = {
    "G06N": "Artificial Intelligence & Neural Systems",
    "G06F": "Computer Architecture & Data Processing",
    "G06T": "Computer Vision & Image Processing",
    "G06K": "Pattern Recognition & Data Capture",
    "G08G": "Traffic Control & Autonomous Vehicles",
    "G01S": "Radar, Lidar & Sensor Tracking",
    "G16H": "Healthcare Informatics & Digital Health",
    "A61B": "Biomedical Devices & Diagnostics",
    "A61K": "Therapeutics & Biotechnology",
    "H04L": "Network Communications & Cryptography",
    "H04W": "Wireless & Cellular Telecommunications",
    "H01L": "Semiconductor Devices & Nanoelectronics",
    "G06Q": "Fintech & Distributed Computing",
    "G10L": "Speech Recognition & NLP",
}


def categorize_patent(ipc_class: str, title: str, abstract: str) -> str:
    """Classify patent into an intuitive technical category."""
    ipc_upper = (ipc_class or "").strip().upper()
    for code, cat_name in IPC_CATEGORY_MAP.items():
        if code in ipc_upper:
            return cat_name

    text = (title + " " + abstract).lower()
    if any(k in text for k in ["neural", "machine learning", "deep learning", "transformer", "model", "ai "]):
        return "Artificial Intelligence & Machine Learning"
    if any(k in text for k in ["quantum", "qubit", "eigensolver", "superposition"]):
        return "Quantum & Advanced Computing"
    if any(k in text for k in ["vehicle", "autonomous", "lidar", "radar", "obstacle", "drone"]):
        return "Autonomous Systems & Robotics"
    if any(k in text for k in ["medical", "tissue", "patient", "surgical", "blood", "health", "biomedical"]):
        return "Healthcare & Biomedical"
    if any(k in text for k in ["privacy", "encryption", "federated", "security", "blockchain"]):
        return "Privacy & Secure Computing"
    if any(k in text for k in ["semiconductor", "chip", "spiking", "neuromorphic", "hardware", "crossbar"]):
        return "Semiconductors & Edge Hardware"

    return "Advanced Technologies"


def extract_shared_concepts(text_a: str, text_b: str, top_n: int = 4) -> List[str]:
    """Find shared technical concepts between two patents."""
    kw_a = set(extract_keywords(text_a, top_n=15))
    kw_b = set(extract_keywords(text_b, top_n=15))
    shared = list(kw_a.intersection(kw_b))

    # If intersection is small, fall back to significant bigrams/words
    if len(shared) < 2:
        words_a = set(re.findall(r"\b[a-z]{4,15}\b", text_a.lower()))
        words_b = set(re.findall(r"\b[a-z]{4,15}\b", text_b.lower()))
        stop_words = {"system", "method", "device", "using", "first", "second", "plurality", "configured", "based", "wherein", "including", "present", "invention"}
        shared_words = list((words_a.intersection(words_b)) - stop_words)
        shared.extend(shared_words[:top_n])

    return list(dict.fromkeys(shared))[:top_n]


def generate_patent_network(
    central_patent_id: Optional[str] = None,
    query_text: Optional[str] = None,
    top_k: int = 12,
    min_similarity: float = 0.25,
    user_id: str = "anonymous",
) -> PatentNetworkResponse:
    """
    Generate an interactive semantic network graph centered on a selected patent or query.
    """
    start_time = time.time()
    network_id = f"net_{uuid.uuid4().hex[:12]}"

    # Step 1: Resolve Central Patent / Query
    central_doc: Optional[Dict[str, any]] = None
    if central_patent_id:
        try:
            central_doc = patent_service.get_patent_by_id(central_patent_id)
        except Exception as e:
            logger.warning("[NETWORK] Could not find patent by ID '%s': %s", central_patent_id, e)

    if not central_doc and query_text:
        # Search FAISS to find the closest patent in catalog as central node
        query_emb = embedding_service.get_embedding(query_text)
        search_results = search_service.search(query_emb, top_k=1, query_text=query_text)
        if search_results:
            central_patent_id = search_results[0].id
            central_doc = patent_service.get_patent_by_id(central_patent_id)

    if not central_doc:
        # Default to the first indexed patent in catalog
        all_patents = patent_service.get_all_patents_list()
        if all_patents:
            central_patent_id = all_patents[0]["id"]
            central_doc = patent_service.get_patent_by_id(central_patent_id)
        else:
            raise ValueError("No indexed patents found to generate similarity network.")

    central_id = central_doc["id"]
    central_title = central_doc.get("title", "Central Patent")
    central_abstract = central_doc.get("abstract", "")
    central_ipc = central_doc.get("ipc_class", "")
    central_assignee = central_doc.get("assignee", "PatentAI Assignee")
    central_date = central_doc.get("publication_date", "2024-01-01")
    central_cat = categorize_patent(central_ipc, central_title, central_abstract)

    # Step 2: Retrieve Nearest Neighbor Patents via FAISS
    central_text = f"{central_title}. {central_abstract}. {central_doc.get('description', '')[:500]}"
    central_emb = embedding_service.get_embedding(central_text)

    # Retrieve top (top_k + 1) to account for the central patent itself
    raw_results = search_service.search(central_emb, top_k=top_k + 3, query_text=central_text)

    # Filter out central patent and filter by min_similarity
    neighbor_patents: List[PatentResult] = [
        r for r in raw_results if r.id != central_id and r.similarity_score >= min_similarity
    ][:top_k]

    # Step 3: Construct Nodes
    nodes: List[NetworkNode] = []
    node_id_set: Set[str] = set()

    # Central Node
    central_node = NetworkNode(
        id=central_id,
        title=central_title,
        abstract=central_abstract,
        assignee=central_assignee,
        publication_date=central_date,
        ipc_class=central_ipc,
        category=central_cat,
        similarity_score=1.0,
        shared_concepts=extract_keywords(central_abstract or central_title, top_n=5),
        source_url=f"https://patents.google.com/patent/{central_id}/en",
        is_central=True,
    )
    nodes.append(central_node)
    node_id_set.add(central_id)

    # Neighbor Nodes
    neighbor_embeddings: Dict[str, np.ndarray] = {central_id: central_emb}
    categories_set: Set[str] = {central_cat}

    for p in neighbor_patents:
        if p.id in node_id_set:
            continue

        p_cat = categorize_patent(p.ipc_class, p.title, p.abstract)
        categories_set.add(p_cat)

        p_shared = extract_shared_concepts(central_text, f"{p.title} {p.abstract}")

        node = NetworkNode(
            id=p.id,
            title=p.title,
            abstract=p.abstract,
            assignee=p.assignee or "Technology Corp",
            publication_date=p.publication_date or "2025-01-01",
            ipc_class=p.ipc_class or "G06F",
            category=p_cat,
            similarity_score=round(float(p.similarity_score), 4),
            shared_concepts=p_shared,
            source_url=f"https://patents.google.com/patent/{p.id}/en",
            is_central=False,
        )
        nodes.append(node)
        node_id_set.add(p.id)

        # Precompute embedding for cross-edge calculation
        p_text = f"{p.title}. {p.abstract}"
        neighbor_embeddings[p.id] = embedding_service.get_embedding(p_text)

    # Step 4: Construct Edges (Star-spokes to Central Node + Cluster Interconnections)
    edges: List[NetworkEdge] = []
    edge_pairs: Set[Tuple[str, str]] = set()

    # Primary Spokes: Central Node -> Each Neighbor
    for n in nodes:
        if n.id == central_id:
            continue

        shared_kw = extract_shared_concepts(central_text, f"{n.title} {n.abstract}", top_n=3)
        edges.append(NetworkEdge(
            source=central_id,
            target=n.id,
            similarity=n.similarity_score,
            label=f"{int(round(n.similarity_score * 100))}% Match",
            shared_keywords=shared_kw,
        ))
        edge_pairs.add((central_id, n.id))
        edge_pairs.add((n.id, central_id))

    # Cross-Edges: Connect neighbor nodes with high mutual cosine similarity (> 0.40)
    # This transforms the graph from a simple star into an organic cluster graph!
    node_ids = [n.id for n in nodes if n.id != central_id]
    for i in range(len(node_ids)):
        for j in range(i + 1, len(node_ids)):
            id_a, id_b = node_ids[i], node_ids[j]
            emb_a = neighbor_embeddings.get(id_a)
            emb_b = neighbor_embeddings.get(id_b)

            if emb_a is not None and emb_b is not None:
                sim = float(np.dot(emb_a, emb_b))
                # Only link if significant mutual connection
                if sim >= 0.48:
                    doc_a = next((x for x in nodes if x.id == id_a), None)
                    doc_b = next((x for x in nodes if x.id == id_b), None)
                    kw = extract_shared_concepts(
                        f"{doc_a.title} {doc_a.abstract}" if doc_a else "",
                        f"{doc_b.title} {doc_b.abstract}" if doc_b else "",
                        top_n=2,
                    )

                    edges.append(NetworkEdge(
                        source=id_a,
                        target=id_b,
                        similarity=round(sim, 4),
                        label=f"{int(round(sim * 100))}% Cluster",
                        shared_keywords=kw,
                    ))
                    edge_pairs.add((id_a, id_b))

    # Compute overall graph metrics
    neighbor_scores = [n.similarity_score for n in nodes if not n.is_central]
    avg_sim = round(float(np.mean(neighbor_scores)), 4) if neighbor_scores else 1.0

    processing_time = round((time.time() - start_time) * 1000, 2)

    return PatentNetworkResponse(
        id=network_id,
        user_id=user_id,
        central_patent_id=central_id,
        central_title=central_title,
        nodes=nodes,
        edges=edges,
        categories=sorted(list(categories_set)),
        total_nodes=len(nodes),
        total_edges=len(edges),
        avg_similarity=avg_sim,
        created_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        processing_time_ms=processing_time,
    )
