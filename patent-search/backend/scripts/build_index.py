"""
Build FAISS index from patents.csv.

Run from the backend/ directory:
    python scripts/build_index.py

Outputs:
    data/patents.index        — FAISS IndexFlatIP
    data/patents_metadata.pkl — pandas DataFrame of patent records
"""

import logging
import pickle
import sys
from pathlib import Path

# Allow imports from app/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import faiss
import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-8s │ %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
CSV_PATH = DATA_DIR / "patents.csv"
INDEX_PATH = DATA_DIR / "patents.index"
METADATA_PATH = DATA_DIR / "patents_metadata.pkl"
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
BATCH_SIZE = 32


def build_index() -> None:
    logger.info("═══ PatentAI FAISS Index Builder ═══")

    # ── Load CSV ──────────────────────────────────────────────────────────────
    if not CSV_PATH.exists():
        logger.error("patents.csv not found at %s", CSV_PATH)
        sys.exit(1)

    df = pd.read_csv(CSV_PATH)
    logger.info("Loaded %d patents from CSV.", len(df))

    required_cols = {"id", "title", "abstract", "description"}
    missing = required_cols - set(df.columns)
    if missing:
        logger.error("Missing required columns: %s", missing)
        sys.exit(1)

    # ── Create text corpus for embedding ─────────────────────────────────────
    # Combine title + abstract + description for richer semantic representation
    corpus = (
        df["title"].fillna("").astype(str)
        + " "
        + df["abstract"].fillna("").astype(str)
        + " "
        + df["description"].fillna("").astype(str)
    ).tolist()

    # ── Load model ────────────────────────────────────────────────────────────
    logger.info("Loading embedding model: %s", EMBEDDING_MODEL)
    try:
        model = SentenceTransformer(EMBEDDING_MODEL, local_files_only=True)
    except Exception:
        model = SentenceTransformer(EMBEDDING_MODEL)

    # ── Generate embeddings in batches ────────────────────────────────────────
    logger.info("Generating embeddings for %d patents …", len(corpus))
    embeddings: np.ndarray = model.encode(
        corpus,
        normalize_embeddings=True,  # L2 normalization for cosine similarity via dot product
        batch_size=BATCH_SIZE,
        show_progress_bar=True,
        convert_to_numpy=True,
    )
    embeddings = embeddings.astype(np.float32)
    logger.info("Generated embeddings of shape %s.", embeddings.shape)

    # ── Build FAISS index ─────────────────────────────────────────────────────
    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)  # Inner product = cosine similarity for normalized vectors
    index.add(embeddings)
    logger.info("FAISS index built: %d vectors, dimension %d.", index.ntotal, dim)

    # ── Save artifacts ────────────────────────────────────────────────────────
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    faiss.write_index(index, str(INDEX_PATH))
    logger.info("FAISS index saved to %s", INDEX_PATH)

    with open(METADATA_PATH, "wb") as f:
        pickle.dump(df.reset_index(drop=True), f, protocol=pickle.HIGHEST_PROTOCOL)
    logger.info("Metadata saved to %s", METADATA_PATH)

    logger.info("═══ Index build complete ═══")
    logger.info("  Patents indexed : %d", index.ntotal)
    logger.info("  Embedding dim   : %d", dim)
    logger.info("  Index file      : %s", INDEX_PATH)
    logger.info("  Metadata file   : %s", METADATA_PATH)


if __name__ == "__main__":
    build_index()
