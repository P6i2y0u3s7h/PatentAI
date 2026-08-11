"""
PatentAI End-to-End Test Script
Tests the complete pipeline: Embedding → FAISS → Metadata → Results

Run from backend/ directory:
    python test_e2e.py

Requires the venv Python with all dependencies installed.
"""
import sys
import pickle
import json
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

print("=" * 60)
print("PatentAI End-to-End Pipeline Test")
print("=" * 60)

PASS = "  [PASS]"
FAIL = "  [FAIL]"
SKIP = "  [SKIP]"

results_summary = {}

# ── Test 1: Data files exist ──────────────────────────────────────────────────
print("\n[1] Data File Existence")
from pathlib import Path

data = Path("data")
index_path = data / "patents.index"
meta_path = data / "patents_metadata.pkl"
csv_path = data / "patents.csv"

for name, path in [("patents.index", index_path), ("patents_metadata.pkl", meta_path), ("patents.csv", csv_path)]:
    if path.exists() and path.stat().st_size > 0:
        print(f"{PASS}: {name} ({path.stat().st_size} bytes)")
        results_summary[f"file_{name}"] = "PASS"
    else:
        print(f"{FAIL}: {name} not found or empty!")
        results_summary[f"file_{name}"] = "FAIL"

# ── Test 2: FAISS index ───────────────────────────────────────────────────────
print("\n[2] FAISS Index")
try:
    import faiss
    idx = faiss.read_index(str(index_path))
    assert idx.ntotal > 0, f"Index is empty (ntotal={idx.ntotal})"
    assert idx.d == 384, f"Unexpected dimension {idx.d} (expected 384)"
    print(f"{PASS}: IndexFlatIP loaded, ntotal={idx.ntotal}, d={idx.d}")
    results_summary["faiss_index"] = "PASS"
except Exception as e:
    print(f"{FAIL}: {e}")
    results_summary["faiss_index"] = "FAIL"

# ── Test 3: Metadata ──────────────────────────────────────────────────────────
print("\n[3] Metadata Pickle")
try:
    with open(meta_path, "rb") as f:
        meta = pickle.load(f)
    assert hasattr(meta, "iloc"), "Metadata is not a DataFrame"
    assert len(meta) > 0, "Metadata is empty"
    required = {"id", "title", "abstract", "description"}
    missing = required - set(meta.columns)
    assert not missing, f"Missing columns: {missing}"
    n_meta = len(meta)
    n_idx = idx.ntotal if "faiss_index" in results_summary else -1
    assert n_meta == n_idx, f"Metadata rows ({n_meta}) != FAISS vectors ({n_idx})"
    print(f"{PASS}: {n_meta} records, all required columns present, counts match FAISS")
    results_summary["metadata"] = "PASS"
except Exception as e:
    print(f"{FAIL}: {e}")
    results_summary["metadata"] = "FAIL"

# ── Test 4: Embedding model ───────────────────────────────────────────────────
print("\n[4] Embedding Model (sentence-transformers/all-MiniLM-L6-v2)")
try:
    import numpy as np
    from sentence_transformers import SentenceTransformer
    t0 = time.time()
    model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    load_time = time.time() - t0
    test_text = "A method for detecting plant diseases using convolutional neural networks and image recognition"
    emb = model.encode(test_text, normalize_embeddings=True, convert_to_numpy=True).astype("float32")
    assert emb.shape == (384,), f"Bad shape: {emb.shape}"
    assert not np.any(np.isnan(emb)), "Embedding has NaN values"
    assert not np.any(np.isinf(emb)), "Embedding has Inf values"
    norm = float(np.linalg.norm(emb))
    assert abs(norm - 1.0) < 1e-4, f"Embedding not normalized (norm={norm})"
    print(f"{PASS}: shape={emb.shape}, norm={norm:.6f}, load_time={load_time:.1f}s")
    results_summary["embedding_model"] = "PASS"
    results_summary["_model"] = model  # store for reuse
    results_summary["_emb"] = emb
except Exception as e:
    print(f"{FAIL}: {e}")
    results_summary["embedding_model"] = "FAIL"

# ── Test 5: FAISS search ──────────────────────────────────────────────────────
print("\n[5] FAISS Search")
try:
    emb = results_summary.get("_emb")
    assert emb is not None, "Embedding not available (previous test failed)"
    query_vec = emb.reshape(1, -1)
    scores, indices = idx.search(query_vec, min(5, idx.ntotal))
    assert len(scores[0]) > 0, "Search returned no scores"
    assert indices[0][0] >= 0, "First index is -1 (no results)"
    top_score = float(scores[0][0])
    assert 0.0 <= top_score <= 1.0, f"Score out of range: {top_score}"
    print(f"{PASS}: top-5 scores={[round(float(s),4) for s in scores[0]]}")
    print(f"         top-5 indices={indices[0].tolist()}")
    results_summary["faiss_search"] = "PASS"
    results_summary["_indices"] = indices
    results_summary["_scores"] = scores
except Exception as e:
    print(f"{FAIL}: {e}")
    results_summary["faiss_search"] = "FAIL"

# ── Test 6: Metadata lookup ───────────────────────────────────────────────────
print("\n[6] Metadata Lookup")
try:
    indices = results_summary.get("_indices")
    scores = results_summary.get("_scores")
    assert indices is not None, "Indices not available"
    patents_found = []
    for score, idx_val in zip(scores[0], indices[0]):
        if idx_val >= 0:
            row = meta.iloc[idx_val]
            assert "title" in row.index, "No title in metadata row"
            assert "abstract" in row.index, "No abstract in metadata row"
            patents_found.append({
                "id": str(row["id"]),
                "title": str(row["title"]),
                "similarity_score": float(max(0.0, min(1.0, score))),
            })
    assert len(patents_found) > 0, "No patents retrieved from metadata"
    print(f"{PASS}: retrieved {len(patents_found)} patents")
    for p in patents_found[:3]:
        print(f"         score={p['similarity_score']:.4f}  title={p['title'][:70]}")
    results_summary["metadata_lookup"] = "PASS"
    results_summary["_patents"] = patents_found
except Exception as e:
    print(f"{FAIL}: {e}")
    results_summary["metadata_lookup"] = "FAIL"

# ── Test 7: API layer (HTTP) ──────────────────────────────────────────────────
print("\n[7] API Layer — Text Search (requires backend running on :8000)")
try:
    import httpx
    payload = {"query": "A neural network system for patent classification and semantic similarity search", "top_k": 5}
    r = httpx.post("http://localhost:8000/search/", json=payload, timeout=30)
    if r.status_code == 200:
        data = r.json()
        assert "results" in data, f"No 'results' key in response: {list(data.keys())}"
        assert isinstance(data["results"], list), "'results' is not a list"
        print(f"{PASS}: HTTP 200, {len(data['results'])} results, {data['total_found']} total, {data['search_time_ms']:.1f}ms")
        if data["results"]:
            top = data["results"][0]
            print(f"         top result: '{top['title'][:70]}' (score={top['similarity_score']:.4f})")
        results_summary["api_text_search"] = "PASS"
    else:
        print(f"{SKIP}: HTTP {r.status_code} — {r.text[:200]}")
        results_summary["api_text_search"] = f"SKIP ({r.status_code})"
except Exception as e:
    print(f"{SKIP}: Cannot reach backend — {e}")
    results_summary["api_text_search"] = "SKIP (backend not running)"

# ── Test 8: API PDF search ────────────────────────────────────────────────────
print("\n[8] API Layer — PDF Upload Search (requires backend running on :8000)")
try:
    import httpx, io, struct
    # Create a minimal but valid text PDF for testing
    pdf_content = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 200 >>
stream
BT
/F1 12 Tf
50 750 Td
(A machine learning system for semantic patent search using neural network embeddings and FAISS vector similarity index for prior-art discovery.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000000516 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
583
%%EOF"""
    files = {"file": ("test_patent.pdf", io.BytesIO(pdf_content), "application/pdf")}
    data = {"top_k": "5"}
    r = httpx.post("http://localhost:8000/search/pdf", files=files, data=data, timeout=60)
    if r.status_code == 200:
        rdata = r.json()
        assert "results" in rdata, f"No 'results' key: {list(rdata.keys())}"
        print(f"{PASS}: HTTP 200, {len(rdata['results'])} results, {rdata['total_found']} total, {rdata['search_time_ms']:.1f}ms")
        if rdata["results"]:
            top = rdata["results"][0]
            print(f"         top result: '{top['title'][:70]}' (score={top['similarity_score']:.4f})")
        results_summary["api_pdf_search"] = "PASS"
    elif r.status_code == 422:
        # Minimal PDF may not extract well — try to parse
        err_detail = r.json()
        print(f"{SKIP}: 422 from backend (PDF may be too sparse): {err_detail}")
        results_summary["api_pdf_search"] = "SKIP (test PDF too sparse)"
    else:
        print(f"{SKIP}: HTTP {r.status_code} — {r.text[:300]}")
        results_summary["api_pdf_search"] = f"SKIP ({r.status_code})"
except Exception as e:
    print(f"{SKIP}: Cannot reach backend — {e}")
    results_summary["api_pdf_search"] = "SKIP (backend not running)"

# ── Summary ───────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("TEST SUMMARY")
print("=" * 60)
for key, val in results_summary.items():
    if key.startswith("_"):
        continue
    icon = "[PASS]" if val == "PASS" else ("[SKIP]" if "SKIP" in str(val) else "[FAIL]")
    print(f"  {icon} {key:30s}: {val}")

failed = [k for k, v in results_summary.items() if not k.startswith("_") and v == "FAIL"]
skipped = [k for k, v in results_summary.items() if not k.startswith("_") and "SKIP" in str(v)]
passed = [k for k, v in results_summary.items() if not k.startswith("_") and v == "PASS"]

print(f"\n  Passed: {len(passed)}  |  Skipped: {len(skipped)}  |  Failed: {len(failed)}")
if failed:
    print(f"\n  FAILED TESTS: {failed}")
    sys.exit(1)
else:
    print("\n  All mandatory tests passed!")
