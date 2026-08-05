# 🚀 PatentAI — Production AI Patent Prior-Art Search Platform

PatentAI is an enterprise-grade prior-art search and patent summarization platform built using vector embeddings (FAISS), transformer models (`sentence-transformers/all-MiniLM-L6-v2` & `facebook/bart-large-cnn`), FastAPI, React 19, Tailwind CSS, and Firebase.

---

## 🏗 System Architecture

```
                                  ┌────────────────────────┐
                                  │   React 19 Frontend    │
                                  │ (Vite + Tailwind CSS)  │
                                  └───────────┬────────────┘
                                              │ HTTP / JSON
                                              ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 FastAPI Backend (Python)                               │
│                                                                                        │
│  ┌───────────────────────┐   ┌───────────────────────────┐   ┌──────────────────────┐  │
│  │   Text / PDF Upload   │──►│   MiniLM-L6-v2 Embedding  │──►│   FAISS Vector Index │  │
│  └───────────────────────┘   └───────────────────────────┘   └──────────┬───────────┘  │
│                                                                         │              │
│  ┌───────────────────────┐   ┌───────────────────────────┐              ▼              │
│  │   BART Summarization  │   │  Firebase Admin / History │◄──── Top-K Prior Art        │
│  └───────────────────────┘   └───────────────────────────┘       Search Results        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Quick Start

### 1. Prerequisites
* Python 3.11+
* Node.js 18+
* Git

---

### 2. Backend Setup & FAISS Index Build

```bash
cd patent-search/backend

# Create virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Step 1: Build the FAISS Vector Index from sample dataset
python scripts/build_index.py

# Step 2: Start backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Backend will be available at: `http://localhost:8000` (API Docs at `/docs`).

---

### 3. Frontend Setup

```bash
cd patent-search/frontend

# Install node dependencies
npm install

# Start development server
npm run dev
```
Frontend will be available at: `http://localhost:5173`.

---

## 🐳 Docker Setup (One-Command Startup)

```bash
docker-compose up --build
```

---

## ⚙️ Environment Variables

### Backend (`patent-search/backend/.env`)
```env
APP_NAME=PatentAI
APP_VERSION=1.0.0
HOST=0.0.0.0
PORT=8000
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
SUMMARIZATION_MODEL=facebook/bart-large-cnn
FIREBASE_CREDENTIALS_PATH=firebase-service-account.json
```

### Frontend (`patent-search/frontend/.env`)
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_PROJECT_ID=your-project-id
```

---

## 📌 Features & API Reference

### Health Check
`GET /health`
Returns system status, model load states, and FAISS index status.

### Prior-Art Text Search
`POST /search`
```json
{
  "query": "A quantum computing architecture that enhances neural network inference using qubit superposition",
  "top_k": 10
}
```

### Prior-Art PDF Search
`POST /search/pdf` (Multipart file upload)

### Patent Summarization
`POST /summary`
`POST /summary/pdf`

---

## 🧪 License & Disclaimer
Built for production-grade patent prior-art semantic searching.
