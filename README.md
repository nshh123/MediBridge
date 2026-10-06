# MediBridge Rwanda — Smart E-Prescription, Live Pharmacy Stock Finder & Expiry Alert Network

> **Web Technology Final Course Project (2026–2027)**  
> **Faculty of Information Technology , Instructor: Jeremie U. Tuyisenge** <br>
> **Student: Musoni Nshuti Sam , ID: 28857**

**MediBridge** solves a critical everyday healthcare challenge faced by thousands of patients, doctors, and pharmacists: **locating scarce essential medications across pharmacies in real time, preventing counterfeit or unsafe prescriptions, and eliminating medication wastage from near-expiry stock.**

---

## Quick Start (Zero Complex Setup Required!)

MediBridge features a **Dual-Mode Architecture**:
- **Mode A (Instant Zero-Config Local Run)**: Runs out-of-the-box with just Node.js! If external PostgreSQL, MongoDB, or RabbitMQ servers are not running locally, MediBridge automatically activates its built-in **Node Native SQL Relational Engine (WAL + Foreign Keys)**, **Mongoose-Validated Document Store**, and **In-Process AMQP Topic Exchange Worker**.
- **Mode B (Full Docker Compose Stack)**: Run `docker compose up --build` to launch dedicated containers for **PostgreSQL 16**, **MongoDB 7**, **RabbitMQ 3 Management**, and the **MediBridge App**.

### 1. Start Development Server (Frontend + Backend in 1 Command)
```bash
npm install
npm run dev
```
- **React Frontend UI**: `http://localhost:5173`
- **Express Backend API**: `http://localhost:4000/api/health`

### 2. Run Automated QA & Security Test Suite (Bonus Point 2)
```bash
npm test
```

### 3. Build & Run Production Bundle
```bash
npm run build
npm start
```

---

## 1-Click RBAC Role Switcher & Demo Credentials

You can switch between all 4 **RBAC Roles** in **1 click** using the top bar inside the web app, or sign in via the **OAuth 2.0 / Login Studio** with password `Password123!`:

| RBAC Role | Demo Account Name | Email | Auth Method | Key Capabilities |
|---|---|---|---|---|
| **PATIENT** | Aline Uwase | `aline.patient@medibridge.rw` | Google OAuth 2.0 / JWT | Search live stock, filter by RSSB/MMI/Radiant insurance, reserve medicine (6h hold), receive SMS/Email tokens |
| **DOCTOR** | Dr. Eric Mugisha | `dr.mugisha@medibridge.rw` | Google OAuth 2.0 / JWT | Issue SHA-256 signed E-Prescriptions (`RX-2026-XXXX`) in MongoDB with automatic AI drug-interaction safety checks |
| **PHARMACIST** | Chantal Mukamana | `chantal.pharma@medibridge.rw` | Local JWT / OAuth 2.0 | Manage SQL inventory batches, verify & dispense E-Prescriptions, broadcast `-25%` near-expiry alerts via RabbitMQ |
| **ADMIN** | Jeremie Admin | `admin@medibridge.rw` | GitHub OAuth 2.0 / JWT | Manage user RBAC roles, inspect SQL vs. MongoDB documents live, monitor RabbitMQ queues & LRU cache metrics |

---

## Complete Rubric & Instruction Mapping

| Rubric Item | Implementation & Evidence |
|---|---|
| **1. Problem Statement, Requirements, Quality Attributes & User Stories** | Documented in [`docs/PROJECT_DOCUMENTATION.md`](docs/PROJECT_DOCUMENTATION.md) with 3 user stories, acceptance criteria, and measurable SLAs. |
| **2. Domain & Data Modeling (ER Diagram, Domain Concepts, Schemas)** | Mermaid ER diagram + abstract domain model in [`docs/PROJECT_DOCUMENTATION.md`](docs/PROJECT_DOCUMENTATION.md); SQL DDL in [`server/src/models/schema.sql`](server/src/models/schema.sql); Mongoose schemas in [`server/src/models/mongoSchemas.js`](server/src/models/mongoSchemas.js). |
| **3. Responsive Web Pages & Wireframes** | Built with React 19 + Tailwind CSS v4 (`client/src/`). Wireframes in [`docs/WIREFRAMES_AND_MOCKUPS.md`](docs/WIREFRAMES_AND_MOCKUPS.md) and interactive **Subtab 4** under `Hybrid DB & RBAC`. |
| **4. Backend Architecture (Layered + Event-Driven)** | Express.js layered backend (`routes/` → `middleware/` → `services/` → `config/`). |
| **5. Hybrid Persistence (BOTH Relational & Non-Relational DBs)** | **Relational SQL** (`roles`, `users`, `pharmacies`, `medications`, `pharmacy_inventory`, `stock_reservations`) + **MongoDB Document Store** (`prescriptions`, `clinical_audit_logs`, `ai_triage_reports`). |
| **6. Secure Authentication (OAuth2 + JWT) & Performance Optimization** | RFC 6749 **OAuth 2.0 Authorization Code + PKCE Flow** (`/api/auth/oauth/authorize` & `/api/auth/oauth/token`) + JWT + Bcrypt + **LRU Query Cache** (`X-Cache: HIT/MISS`) + SQL B-Tree Indexes + Gzip compression. |
| **7. RabbitMQ Message Broker for Email, SMS & Events** | [`server/src/services/rabbitmq.js`](server/src/services/rabbitmq.js) using `amqplib` topic exchange `medibridge.events` with 4 queues and live **Server-Sent Events (SSE)** UI console. |
| **8. RBAC Authorization Model** | [`server/src/middleware/rbacMiddleware.js`](server/src/middleware/rbacMiddleware.js) enforcing role and granular permission guards (`requirePermission`) with MongoDB security audit logging. |
| **9. Git Repository History & Pull Request** | Structured multi-commit history on `main` and feature branch `feat/medibridge-full-sdlc` with PR template in [`docs/PULL_REQUEST_TEMPLATE.md`](docs/PULL_REQUEST_TEMPLATE.md). |
| **Bonus 1: DevOps Practices** | [`Dockerfile`](Dockerfile), [`docker-compose.yml`](docker-compose.yml), and GitHub Actions CI/CD workflow [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml). |
| **Bonus 2: Software Testing & QA** | Automated integration test suite in [`server/tests/api.test.js`](server/tests/api.test.js) (`npm test`). |
| **Bonus 3: New Technology Exploration** | **AI Clinical Drug-Interaction, Contraindication & Symptom Triage Engine** ([`server/src/services/aiClinicalEngine.js`](server/src/services/aiClinicalEngine.js)) + Real-Time SSE Telemetry. |
