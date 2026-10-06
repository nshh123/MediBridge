# Pull Request: Complete MediBridge Full-Stack SDLC Implementation (`feat/medibridge-full-sdlc` → `main`)

## Summary of Changes
This Pull Request delivers the complete Software Development Life Cycle (SDLC) implementation of **MediBridge Rwanda** for the Web Technology Final Project:

1. **Requirement 1 (Requirements & User Stories)**:
   - Added problem statement, target users, functional/non-functional quality attributes, and 3 user stories with acceptance criteria in [`docs/PROJECT_DOCUMENTATION.md`](../docs/PROJECT_DOCUMENTATION.md).
2. **Requirement 2 & 5 (Domain Modeling & Hybrid Relational + NoSQL Persistence)**:
   - Implemented Relational SQL schema ([`server/src/models/schema.sql`](../server/src/models/schema.sql)) with Primary Keys, Foreign Keys, CHECK constraints, and 8 B-Tree indexes across `roles`, `users`, `pharmacies`, `medications`, `pharmacy_inventory`, and `stock_reservations`.
   - Implemented Non-Relational MongoDB schemas ([`server/src/models/mongoSchemas.js`](../server/src/models/mongoSchemas.js)) for hierarchical E-Prescriptions (`prescriptions`), security/clinical audit logs (`clinical_audit_logs`), and AI clinical evaluations (`ai_triage_reports`).
3. **Requirement 3 (Responsive Front-End Prototype & Wireframes)**:
   - Built a responsive React 19 + Tailwind CSS v4 Single-Page Application (`client/src/`) with mobile, tablet, and desktop layouts plus interactive wireframe inspection.
4. **Requirement 4 & 7 (Layered + Event-Driven Backend with RabbitMQ Message Broker)**:
   - Implemented `amqplib` topic exchange `medibridge.events` in [`server/src/services/rabbitmq.js`](../server/src/services/rabbitmq.js) with 4 consumer queues (`queue.notifications.sms`, `queue.notifications.email`, `queue.prescriptions.workflow`, `queue.inventory.alerts`) and real-time Server-Sent Events (SSE) telemetry.
5. **Requirement 6 & 8 (OAuth 2.0 Security, Performance Optimization & RBAC)**:
   - Implemented RFC 6749 OAuth 2.0 Authorization Code + PKCE token exchange alongside Bcrypt/JWT authentication.
   - Enforced 4-role RBAC (`PATIENT`, `DOCTOR`, `PHARMACIST`, `ADMIN`) with fine-grained permissions (`requirePermission`).
   - Added TTL/LRU query caching (`X-Cache: HIT/MISS`), Gzip compression, and request latency profiling.
6. **Bonus Points 1, 2 & 3**:
   - **Bonus 1 (DevOps)**: Added multi-stage `Dockerfile`, `docker-compose.yml` (PostgreSQL + MongoDB + RabbitMQ + App), and GitHub Actions CI/CD workflow (`.github/workflows/ci-cd.yml`).
   - **Bonus 2 (QA Testing)**: Added automated integration & security test suite in [`server/tests/api.test.js`](../server/tests/api.test.js) (7/7 tests passing).
   - **Bonus 3 (New Tech)**: Integrated the **AI Clinical Drug-Interaction, Allergy Cross-Reactivity & Symptom Triage Assistant** ([`server/src/services/aiClinicalEngine.js`](../server/src/services/aiClinicalEngine.js)).

## Verification & QA Checklist
- [x] `npm test` passes all 7 integration, RBAC, OAuth2, Hybrid DB, and RabbitMQ test suites.
- [x] `npm run build` compiles production React + Tailwind CSS assets into `dist/`.
- [x] Zero-configuration startup (`npm run dev`) verified.
