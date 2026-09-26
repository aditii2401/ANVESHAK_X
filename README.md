# ANVESHAKX — AI-Powered Criminal Network Analysis System

**Smart India Hackathon 2026 · Problem Statement ID: SIH26189**
**Theme:** Blockchain & Cybersecurity · **PS Category:** Software · **Team:** AnveshakX

> From fragmented FIRs, call records and financial transactions to a single, explainable criminal-network graph — with every alert traceable back to the source evidence that generated it.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Our Solution](#2-our-solution)
3. [System Architecture](#3-system-architecture)
4. [Technical Workflow](#4-technical-workflow)
5. [Tech Stack](#5-tech-stack)
6. [Project Structure](#6-project-structure)
7. [Database Schema](#7-database-schema)
8. [Setup & Installation](#8-setup--installation)
9. [Running the Project](#9-running-the-project)
10. [API Reference](#10-api-reference)
11. [Extraction Pipeline in Detail](#11-extraction-pipeline-in-detail)
12. [Detection Rules (Suspicious Pattern Engine)](#12-detection-rules-suspicious-pattern-engine)
13. [Anti-Hallucination Guarantees](#13-anti-hallucination-guarantees)
14. [Sample / Synthetic Dataset](#14-sample--synthetic-dataset)
15. [Team](#15-team)
16. [License & Disclaimer](#16-license--disclaimer)

---

## 1. Problem Statement

Criminal intelligence is scattered across FIRs, Call Detail Records (CDRs), financial transaction logs and other investigation documents, each maintained independently and rarely cross-referenced. Because of this fragmentation:

- Critical relationships between people, accounts, vehicles and locations remain **hidden**, since investigators must manually correlate heterogeneous, unstructured data.
- The same real person can appear under different name spellings, aliases, or partial identifiers across sources, with no automated way to resolve them into one identity.
- Investigators have no fast way to see *why* two records might be connected, or which entities structurally bridge otherwise separate groups.

**ANVESHAK** addresses this by extracting entities and relationships from raw investigation text, resolving duplicate identities across sources, building a relationship graph, and surfacing evidence-backed alerts — while keeping the final decision with the human investigator at every step.

---

## 2. Our Solution

A four-stage pipeline converts fragmented records into actionable, explainable intelligence:

| Stage | What it does |
|---|---|
| **1. Extract** | Pulls entities (persons, phones, accounts, vehicles) out of FIRs, CDRs and financial records using NLP + regex. |
| **2. Resolve** | Detects when different records refer to the same real person using normalization, alias matching, and fuzzy string matching. |
| **3. Relate** | Builds relationships between entities from evidence found in the source documents (never guessed). |
| **4. Analyze** | Constructs a criminal relationship graph and runs graph analytics to surface prime suspects, bridge entities, and suspicious patterns. |

**Design principles carried through every module:**
- **Evidence-backed, never guessed** — every extracted claim is re-verified against the source document's own text before it's allowed to become a database row.
- **Human-in-the-loop** — the system flags and ranks; a human investigator makes the final call.
- **Explainable, not a black box** — every alert states the graph metric or rule that triggered it, plus the exact supporting text.

---

## 3. System Architecture

```mermaid
flowchart TD
    subgraph Sources["Evidence Sources"]
        FIR["FIR / Case Records (.pdf / .txt)"]
        CDR["Call Detail Records"]
        FIN["Financial Transactions"]
    end

    subgraph Backend["FastAPI Backend"]
        Router["Router.py — API layer"]
        Pipeline["Extraction Pipeline\n(pdf_extractor → spaCy → regex → Gemini → entity_resolver)"]
        Graph["graph_analysis.py\n(NetworkX + detection rules)"]
        Evidence["evidence_engine.py\n(alert generation)"]
        Chat["lyzr_chat.py\n(AI Assistant agent)"]
    end

    subgraph DB["PostgreSQL (Neon)"]
        Tables["documents · persons · person_aliases\nphones · accounts · vehicles\nrelationships · transactions · call_records\naudit_ingestion_logs"]
    end

    subgraph Frontend["React + TypeScript (Vite)"]
        Upload["Database Upload & Ingestion"]
        Dashboard["Network Analysis Dashboard"]
        NetworkView["Interactive Graph Explorer"]
        AI["AI Assistant (chat)"]
    end

    FIR --> Router
    CDR --> Router
    FIN --> Router

    Router --> Pipeline
    Pipeline --> Tables
    Router --> Graph
    Graph --> Tables
    Graph --> Evidence

    Upload -->|POST /api/upload| Router
    Dashboard -->|GET /api/graph| Router
    NetworkView -->|GET /api/graph, /api/analyze-graph| Router
    AI -->|POST /api/chat| Chat
```

---

## 4. Technical Workflow

```
FIR (.pdf / .txt)
   │
   ▼
pdf_extractor.py     Text extraction (PyMuPDF for PDF) + cleaning + sentence/paragraph segmentation
   │
   ▼
spacy_extractor.py   spaCy NER + custom EntityRuler → candidate PERSON / ORG / GPE / vehicle mentions
   │
   ▼
regex_extractor.py   Deterministic extraction: phones, accounts, IFSC, vehicle regs, dates, times,
                     money, emails, FIR/case numbers — with format-based validation
   │
   ▼
gemini_extractor.py  Chunks the FIR, prompts Gemini for persons/roles/aliases/relationships/
                     transactions/vehicles/calls, validates the JSON with Pydantic, then verifies
                     every claim against the FIR's own text (anti-hallucination gate)
   │
   ▼
entity_resolver.py   Conservative alias/entity merging (never guesses identity), then links
                     phones/accounts/transactions/vehicles/calls to resolved persons via a
                     stable person_id — never a name — as the foreign key
   │
   ▼
main.py              Final referential-integrity validation
   │
   ▼
csv_writer.py / db.py   Writes CSVs locally AND persists every table to PostgreSQL
   │
   ▼
graph_analysis.py    Loads relationships into NetworkX, runs centrality/community detection
   │                 and the four suspicious-pattern detection rules
   ▼
evidence_engine.py   Converts detection results into human-readable, evidence-linked alerts
   │
   ▼
React Dashboard      Interactive graph, entity dossier, alerts table, AI assistant
```

**End-to-end request flow for an FIR upload:**

1. Investigator drops a `.pdf`/`.txt` FIR into the **Database Upload & Ingestion** screen.
2. Frontend `POST`s the file to `FastAPI /api/upload`.
3. `Router.py` calls `main.run_pipeline()`, which runs the full extraction chain above.
4. Every resolved person, alias, phone, account, vehicle, transaction, relationship and call record is written to PostgreSQL via `db.py`'s `get_or_create_*` functions (deduplicating by normalized name / phone number / account number / registration number).
5. The API responds with row counts, validation status, and any warnings — shown immediately in the UI.
6. The **Network Graph Explorer** and **Dashboard** then call `GET /api/graph`, which fetches relationships from Postgres, runs entity resolution + graph construction, and returns nodes/edges for visualization.
7. `POST /api/analyze-graph` additionally runs the four detection rules and returns ranked, evidence-backed alerts.
8. The **AI Assistant** tab lets investigators ask natural-language questions, answered by a Lyzr-hosted agent (`lyzr_chat.py`) with retrieval over the case documents.

---

## 5. Tech Stack

### Backend
| Component | Technology |
|---|---|
| API layer | **FastAPI** (Python 3.11) |
| PDF/text extraction | **PyMuPDF** |
| NLP / NER | **spaCy** (`en_core_web_sm`) + custom EntityRuler patterns |
| Deterministic extraction | **Regex** (phones, accounts, IFSC, vehicle regs, dates, money, PAN, Aadhaar, etc.) |
| Semantic extraction | **Google Gemini** (`google-genai`) — roles, aliases, relationships, transactions |
| Entity resolution | **RapidFuzz** (fuzzy name matching) + conservative rule-based merging |
| Data validation | **Pydantic v2** (lenient LLM-output contracts + strict CSV row schemas) |
| Graph analytics | **NetworkX** (centrality, community detection, cycle detection) |
| Data wrangling | **Pandas / NumPy** |
| Database | **PostgreSQL** (hosted on **Neon**), via `psycopg2` |
| AI conversational assistant | **Lyzr Agent Studio** (hosted inference API) |
| Config | `python-dotenv` |

### Frontend
| Component | Technology |
|---|---|
| Framework | **React 19** + **TypeScript** |
| Build tool | **Vite 6** |
| Routing | **React Router v7** |
| Styling | **Tailwind CSS v4** |
| Icons | **lucide-react** |
| Animation | **Framer Motion** (`motion`) |
| AI integration (client-side) | `@google/genai` |

### Infrastructure
- **Database:** PostgreSQL (Neon serverless Postgres)
- **LLM providers:** Google Gemini (extraction) + Lyzr Agent Studio (conversational assistant, with document retrieval over FIR/case records)

---

## 6. Project Structure

```
anveshak/
├── backend/
│   ├── Router.py                 # FastAPI app: all HTTP routes
│   ├── main.py                   # Pipeline orchestration + CLI entry point
│   ├── pdf_extractor.py          # PDF/TXT loading, cleaning, segmentation
│   ├── spacy_extractor.py        # spaCy NER + EntityRuler
│   ├── regex_extractor.py        # Deterministic identifier/date/money extraction
│   ├── gemini_extractor.py       # Gemini prompting, chunking, anti-hallucination verifier
│   ├── entity_resolver.py        # Alias/entity resolution + record linking
│   ├── schemas.py                # Pydantic models (LLM contracts + CSV row schemas)
│   ├── csv_writer.py             # CSV output writer
│   ├── db.py                     # All raw SQL / PostgreSQL access (single source of truth)
│   ├── schema.sql                # Database schema (audit log table, etc.)
│   ├── graph_analysis.py         # NetworkX graph construction + detection rules
│   ├── evidence_engine.py        # Converts detections into explainable alerts
│   ├── resolution.py             # RapidFuzz-based name clustering (graph-analysis path)
│   ├── pipeline.py               # Upload validation + DB storage helpers
│   ├── lyzr_chat.py              # AI Assistant integration (Lyzr Agent Studio)
│   ├── check_db.py               # Utility: inspect DB tables/row counts
│   ├── example_usage.py          # Example pipeline invocation
│   ├── test_pipeline.py          # Pipeline tests
│   ├── requirements.txt
│   ├── .env.example
│   ├── fir_records.txt           # Synthetic sample FIRs
│   ├── *.csv                     # Synthetic seed data (persons, phones, accounts, ...)
│   └── Documentations/           # Tech stack & team plan (PDF)
│
└── frontend/
    ├── src/
    │   ├── App.tsx                        # Route definitions
    │   ├── pages/                         # Dashboard, Investigations, Network, Reports,
    │   │                                    Alerts, AI Assistant, Timeline, Settings, ...
    │   ├── components/
    │   │   ├── DatabaseUploadSection.tsx  # FIR upload UI → /api/upload
    │   │   ├── InvestigationGraphView.tsx # Interactive network graph canvas
    │   │   ├── DashboardClusterView.tsx   # Cluster/graph dashboard view
    │   │   ├── AIAssistantView.tsx        # Chat UI → /api/chat
    │   │   ├── CleanNetworkGraph.tsx      # Graph rendering primitives
    │   │   ├── WhyFlaggedModal.tsx        # Evidence/explainability modal
    │   │   └── ...                        # Modals: Banking Ledger, Call Records,
    │   │                                    Vehicle Logs, FIR Document, Location Map
    │   ├── services/api.ts                # Frontend API client
    │   ├── data/mockData.ts               # Fallback mock data (dev/demo mode)
    │   └── types.ts                       # Shared TypeScript types
    ├── package.json
    ├── vite.config.ts
    └── tsconfig.json
```

---

## 7. Database Schema

Core tables (PostgreSQL), populated by `db.py` on every FIR ingestion:

| Table | Purpose | Key columns |
|---|---|---|
| `documents` | One row per uploaded source file (audit trail) | `document_id`, `doc_type`, `file_name`, `status` |
| `persons` | Canonical, deduplicated person records | `person_id`, `canonical_name`, `normalized_name`, `needs_review` |
| `person_aliases` | Alternate names linked to a canonical person | `person_id`, `alias_text`, `normalized_alias`, `confidence` |
| `phones` | Phone numbers, optionally linked to a person | `phone_id`, `phone_number`, `person_id` (nullable) |
| `accounts` | Bank account numbers, optionally linked to an owner | `account_id`, `account_number`, `owner_id` (nullable) |
| `vehicles` | Vehicle registrations, optionally linked to an owner | `vehicle_id`, `registration_number`, `owner_id` (nullable) |
| `transactions` | Money transfers between two accounts | `transaction_id`, `sender_account_id`, `receiver_account_id`, `amount_inr` |
| `relationships` | Graph edges between two persons (evidence preserved, never deduplicated) | `source_person_id`, `target_person_id`, `rel_type`, `confidence`, `context` |
| `call_records` | Call detail records between two phones | `cdr_id`, `caller_phone_id`, `receiver_phone_id`, `duration_minutes` |
| `extraction_log` | Full audit trail: every raw text span that produced an entity | `entity_type`, `raw_text`, `confidence`, `method` |
| `audit_ingestion_logs` | One row per file upload attempt (success/failure) | `file_name`, `status`, `error_message` |

**Design guarantees:**
- Names are **never** used as foreign keys — every cross-table reference is by stable, sequential ID.
- `get_or_create_*` functions in `db.py` prevent duplicate person/phone/account/vehicle rows on re-ingestion.
- `relationships` intentionally **does not** deduplicate — each mention across documents is preserved as its own piece of evidence.

Run `schema.sql` once against your Postgres instance to create the base audit table; the rest of the schema (`persons`, `phones`, etc.) is created to match the columns `db.py` expects — see `db.py` docstrings for the exact column list per table if creating manually.

---

## 8. Setup & Installation

### Prerequisites
- **Python 3.11+**
- **Node.js 18+**
- A **PostgreSQL** database (e.g. a free [Neon](https://neon.tech) instance)
- A **Google Gemini API key** ([aistudio.google.com/apikey](https://aistudio.google.com/apikey))
- A **Lyzr Agent Studio** API key + agent ID (for the AI Assistant)

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt --break-system-packages
python -m spacy download en_core_web_sm
```

Create a `.env` file in `backend/`:

```env
DB_NAME=your_db_name
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_HOST=your_db_host
DB_PORT=5432
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

GEMINI_API_KEY=your_gemini_api_key
LYZR_API_KEY=your_lyzr_api_key
```

Initialize the database:

```bash
psql "$DATABASE_URL" -f schema.sql
# Then create persons/phones/accounts/etc. tables per db.py's expected columns
```

### Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env` file in `frontend/`:

```env
VITE_API_URL=http://localhost:8000
```

> `VITE_`-prefixed variables are the only ones Vite exposes to the browser. Restart the dev server after changing `.env`.

---

## 9. Running the Project

**Backend** (from `backend/`):

```bash
uvicorn Router:app --reload --port 8000
```

Verify it's up at **`http://localhost:8000/docs`** (Swagger UI — auto-generated from the FastAPI routes).

**Frontend** (from `frontend/`):

```bash
npm run dev
```

Runs on **`http://localhost:3000`**.

**Standalone pipeline** (no API, just CLI — useful for testing extraction in isolation):

```bash
python main.py fir_records.txt -o output/
python main.py fir_records.txt -o output/ --no-gemini   # regex + spaCy only, no API calls
```

---

## 10. API Reference

All endpoints are served by `Router.py`. Full interactive docs at `/docs` once the backend is running.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `POST` | `/api/upload` | Upload one FIR (`.pdf`/`.txt`) → runs the full extraction pipeline → persists all resolved entities/relationships to PostgreSQL. Query param `use_gemini` (default `true`). |
| `POST` | `/api/chat` | Send a natural-language question to the AI Assistant (Lyzr agent). Body: `{ "message": "..." }`. |
| `GET` | `/api/graph` | Returns the resolved network as `{ nodes, edges }` for the frontend graph — fetches relationships from Postgres, runs entity resolution, builds the NetworkX graph. |
| `POST` | `/api/analyze-graph` | Runs the full detection suite (comm-spike, circular flow, bridge entity, crossover) and returns structured, evidence-linked alerts. |

**Example: uploading an FIR**

```bash
curl -X POST "http://localhost:8000/api/upload?use_gemini=true" 
  -F "file=@fir_records.txt"
```

**Example response (abridged):**
```json
{
  "status": "SUCCESS",
  "document_id": "fir_records",
  "db_summary": { "persons": 12, "accounts": 5 },
  "row_counts": { "persons.csv": 12, "relationships.csv": 8, "...": "..." },
  "validation_ok": true,
  "warnings": []
}
```

---

## 11. Extraction Pipeline in Detail

1. **`pdf_extractor.py`** — loads the raw file, normalizes Unicode/whitespace (never rewrites words, so evidence text always matches the original), segments into pages → paragraphs → sentences.
2. **`spacy_extractor.py`** — runs spaCy NER plus a custom `EntityRuler` tuned for Indian FIR conventions (honorifics, role words like "accused"/"witness", vehicle makes/types, police station names). A gazetteer pass catches repeat name mentions that small NER models miss.
3. **`regex_extractor.py`** — deterministically extracts anything with a fixed format: phone numbers, bank accounts, IFSC codes, vehicle registrations (validated against real RTO state codes), PAN, Aadhaar, dates, times, durations, and money amounts (including "₹50,000", "2.5 lakh", etc.).
4. **`gemini_extractor.py`** — sends text chunks to Gemini for the genuinely *semantic* work regex/spaCy can't do: roles, aliases, relationships, who-transferred-to-whom, who-called-whom. Every returned claim is validated against a strict Pydantic schema, then **re-verified against the FIR's own text** — anything Gemini reports that can't be found verbatim in the source is dropped, never "corrected" with invented data.
5. **`entity_resolver.py`** — conservatively merges aliases/duplicate mentions into single canonical persons (never guesses identity across ambiguous cases — e.g. two different "Rahul"s are kept separate and flagged for review), then links phones/accounts/vehicles/transactions/calls to resolved persons by stable ID.
6. **`main.py`** — runs final referential-integrity validation (every foreign key must resolve, every relationship's evidence text must be found in the FIR, low-confidence relationships must be marked `UNCERTAIN`) before anything is written out.

---

## 12. Detection Rules (Suspicious Pattern Engine)

Implemented in `graph_analysis.py` + `evidence_engine.py`, exposed via `POST /api/analyze-graph`:

| Rule | What it detects |
|---|---|
| **Communication Spike** | Unusually high call volume for an entity within a short window. |
| **Circular Money Flow** | Closed transaction loops (e.g. `AC-001 → AC-002 → AC-003 → AC-001`). |
| **Bridge Entity** | Entities with high betweenness centrality that structurally connect otherwise-separate groups. |
| **Multi-Source Crossover** | Entities appearing across multiple independent sources (FIR + CDR + financial records). |

Every alert generated includes a `reason_text` (plain-English explanation), the metric that triggered it, and the linked evidence — so an investigator always sees *why* an entity was flagged, never just a bare score.

---

## 13. Anti-Hallucination Guarantees

- Every person, phone, account, transaction, relationship, vehicle and call reported by the LLM is re-checked against the FIR's own text before becoming a database row. Unverifiable claims are **dropped**, not silently "fixed."
- Relationship `evidence_text` is always re-anchored to the FIR's exact original wording — never the LLM's paraphrase — with the page number it was found on.
- Roles (suspect / accused / victim / complainant / witness / informant / associate) are only assigned when the text explicitly supports it; otherwise `unknown`. Two people merely appearing in the same sentence never creates a relationship.
- Ambiguous alias cases are kept as **separate** persons and flagged for human review — never silently merged.
- Missing values are always `NULL`, never a placeholder guess.
- Relationships below a 0.6 confidence threshold are explicitly marked `UNCERTAIN`.

---

## 14. Sample / Synthetic Dataset

A fully synthetic dataset ships with the backend to demonstrate every capability end-to-end (see `README.txt` and `fir_records.txt` in `backend/`):

- **12 synthetic FIR/intelligence documents**, 20 canonical persons, phones, vehicles, accounts, CDR and transaction records.
- Deliberately engineered to demonstrate: entity resolution (`"Rahul K Sharma"` ↔ `"R. Sharma"`), a communication spike, a circular money-flow loop (`AC-001 → AC-002 → AC-003 → AC-001`), a multi-source crossover entity, and a graph bridge candidate.

> ⚠️ All names, numbers, accounts, vehicles, cases and events in the sample dataset are entirely fictional and must not be interpreted as real allegations.

---

## 15. Team

**Team Anveshak** — Smart India Hackathon 2026
Problem Statement: **SIH26189** · Theme: **Blockchain & Cybersecurity**

*Udit Raghuwanshi - Team Lead, 
Anirudha Sharma - ML Lead,
Aditi Dhakad - Backend pipelines, 
Vanshika Jain - Graph Analysis,
Alafiya Naaz and Aditiya Tiwari - Frontend*
---

## 16. License & Disclaimer

This is a **hackathon prototype** built for demonstration purposes as part of Smart India Hackathon 2026. It is designed to operate on synthetic/sample investigation data. It is **not** a production-ready law-enforcement system and has not undergone the security, compliance, or accuracy review required for real investigative use.

All sample data referenced in this repository is fictional. Any resemblance to real persons, cases, or events is coincidental.


