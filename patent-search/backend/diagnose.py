"""
PatentAI full diagnostic script.
Run from backend/ directory: python diagnose.py
"""
import sys
import pickle
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

print("=== PatentAI Diagnostic ===\n")

data_dir = Path("data")
index_path = data_dir / "patents.index"
meta_path = data_dir / "patents_metadata.pkl"
csv_path = data_dir / "patents.csv"

print(f"[DATA DIR] exists: {data_dir.exists()}")
print(f"[INDEX]    exists: {index_path.exists()}, size: {index_path.stat().st_size if index_path.exists() else 0} bytes")
print(f"[META]     exists: {meta_path.exists()}, size: {meta_path.stat().st_size if meta_path.exists() else 0} bytes")
print(f"[CSV]      exists: {csv_path.exists()}, size: {csv_path.stat().st_size if csv_path.exists() else 0} bytes")

# ── CSV inspection ───────────────────────────────────────────────────────────
if csv_path.exists():
    import pandas as pd
    df = pd.read_csv(csv_path)
    print(f"\n[CSV] rows={len(df)}, columns={list(df.columns)}")
    if "title" in df.columns:
        print(f"[CSV] first title: {df['title'].iloc[0]}")
    required = {"id", "title", "abstract", "description"}
    missing = required - set(df.columns)
    if missing:
        print(f"[CSV] MISSING REQUIRED COLUMNS: {missing}")
    else:
        print("[CSV] All required columns present.")
else:
    print("[CSV] FILE NOT FOUND!")

# ── Metadata pickle inspection ───────────────────────────────────────────────
if meta_path.exists():
    with open(meta_path, "rb") as f:
        meta = pickle.load(f)
    print(f"\n[META] type: {type(meta).__name__}, length: {len(meta)}")
    if hasattr(meta, "columns"):
        print(f"[META] columns: {list(meta.columns)}")
    if hasattr(meta, "iloc"):
        row = meta.iloc[0]
        print(f"[META] first row keys: {list(row.index) if hasattr(row, 'index') else 'N/A'}")
        print(f"[META] first id: {row['id']}")
        print(f"[META] first title: {row['title']}")
else:
    print("[META] FILE NOT FOUND!")

# ── FAISS index inspection ───────────────────────────────────────────────────
if index_path.exists():
    try:
        import faiss
        idx = faiss.read_index(str(index_path))
        print(f"\n[FAISS] ntotal: {idx.ntotal}")
        print(f"[FAISS] dimension (d): {idx.d}")
        print(f"[FAISS] type: {type(idx).__name__}")
        if idx.ntotal == 0:
            print("[FAISS] WARNING: Index is EMPTY! Need to rebuild.")
    except Exception as e:
        print(f"[FAISS] LOAD ERROR: {e}")
else:
    print("[FAISS] INDEX FILE NOT FOUND!")

# ── Embedding model test ─────────────────────────────────────────────────────
print("\n[EMBEDDING] Testing sentence-transformers/all-MiniLM-L6-v2 ...")
try:
    import numpy as np
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    test_text = "A system using machine learning to detect plant diseases from images"
    emb = model.encode(test_text, normalize_embeddings=True, convert_to_numpy=True)
    emb = emb.astype("float32")
    print(f"[EMBEDDING] shape: {emb.shape}, dtype: {emb.dtype}")
    print(f"[EMBEDDING] norm: {float(np.linalg.norm(emb)):.6f}  (should be ~1.0 if normalized)")
    has_nan = bool(np.any(np.isnan(emb)))
    has_inf = bool(np.any(np.isinf(emb)))
    print(f"[EMBEDDING] has NaN: {has_nan}, has Inf: {has_inf}")

    # Now do a live FAISS search if index loaded
    if index_path.exists():
        import faiss
        idx = faiss.read_index(str(index_path))
        if idx.ntotal > 0:
            query_vec = emb.reshape(1, -1)
            scores, indices = idx.search(query_vec, min(5, idx.ntotal))
            print(f"\n[FAISS SEARCH] top-5 scores: {scores[0].tolist()}")
            print(f"[FAISS SEARCH] top-5 indices: {indices[0].tolist()}")

            if meta_path.exists():
                with open(meta_path, "rb") as f:
                    meta = pickle.load(f)
                print("\n[FAISS SEARCH] Results:")
                for score, idx_val in zip(scores[0], indices[0]):
                    if idx_val >= 0:
                        row = meta.iloc[idx_val]
                        print(f"  score={score:.4f}  title={row['title'][:80]}")
        else:
            print("[FAISS SEARCH] SKIPPED: index is empty (ntotal=0)")
except Exception as e:
    print(f"[EMBEDDING] ERROR: {e}")
    import traceback
    traceback.print_exc()

print("\n=== Diagnostic complete ===")
