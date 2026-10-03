# KTEA Customer Management & Intelligence System

> **A high-precision, personal Customer Management & Intelligence platform engineered for operators managing high-touch financial client relationships, application pipelines, deterministic product recommendations, and referral pushes.**

---

## 1. Project Overview

The **KTEA Customer Intelligence System** is an enterprise-grade operational workspace built for single-operator client relationship and referral management. It unifies the full customer lifecycle: from lead ingestion, intent classification, and multi-product case pipelines to deterministic, rule-based product recommendations and referral push execution.

### Key Capabilities
- **Customer 360° Profile**: Unified view of identity, needs, application cases, touchpoints/activities, operator notes, tags, and follow-up schedules.
- **Operational Dashboard**: An answer to *"What should I pay attention to right now?"*, featuring overdue reminders, urgent follow-ups, and top algorithmic recommendation matches.
- **Deterministic Recommendation Engine**: Rule-based intelligence that scores opportunities based on actual needs, declined application recovery, and engagement recency without black-box or hallucinated suggestions.
- **Referral Push Center**: Strict decoupling between algorithmic *recommendation* and operational *referral push*, preserving history and outcome attribution.
- **Descriptive Analytics Engine**: Period-aware reporting on customer cohort velocity, case approval rates, need distributions, and push success ratios calculated from actual database records.
- **Data Governance & Portability**: Filtered JSON exports, sample/CSV batch ingestion with intra-batch duplicate detection and safe cancellation, and database health diagnostics.

---

## 2. Architecture

The system follows a clean, decoupled client-server architecture with strict separation of concerns:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React 18 + Vite)                       │
│  - Tailwind CSS + Lucide Icons + TanStack Query                          │
│  - URL Search Param Synchronized State (Router v6)                       │
│  - Modular feature folders (dashboard, customers, push, settings)        │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │ REST API (JSON / HTTP)
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Node.js + Express)                      │
│                                                                          │
│  ┌───────────────────────┐  ┌─────────────────────────────────────────┐  │
│  │   Routing Layer       │  │           Middleware Layer              │  │
│  │   Express Routers     │  │   Zod Validation, Error Sanitization,   │  │
│  │                       │  │   CORS, Request Logging                 │  │
│  └───────────┬───────────┘  └─────────────────────────────────────────┘  │
│              ▼                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                       Service Layer                                │  │
│  │   CustomerService, CaseService, PushService, AnalyticsService      │  │
│  └───────────┬───────────────────────────────────┬────────────────────┘  │
│              │                                   │                       │
│              ▼                                   ▼                       │
│  ┌─────────────────────────┐     ┌────────────────────────────────────┐  │
│  │  Recommendation Engine  │     │         Repository Layer           │  │
│  │  Feature Extraction     │     │    Prisma ORM Database Client      │  │
│  │  Deterministic Rules    │     │    Optimized Indexes & Queries     │  │
│  │  Scoring & Explanations │     └─────────────────┬──────────────────┘  │
│  └─────────────────────────┘                       │                     │
└────────────────────────────────────────────────────┼─────────────────────┘
                                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           DATABASE (MySQL / MariaDB)                     │
│  - Strict Foreign Keys with Cascade/Restrict Rules                       │
│  - Optimized Multi-Column Indexes                                        │
│  - Zero Orphan Records                                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Tech Stack

### Backend
- **Runtime**: Node.js (v20+ recommended)
- **Framework**: Express.js
- **Language**: TypeScript (v5.6)
- **ORM & Migrations**: Prisma ORM (v5.21)
- **Database**: MySQL / MariaDB (v10.4+)
- **Schema Validation**: Zod (v3.23)
- **Development Tooling**: `tsx` (TypeScript execution & watch mode), ESLint

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite (v5.4)
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom dark-mode slate theme & CSS variables
- **State & Server Cache**: TanStack React Query (v5)
- **Routing**: React Router DOM (v6) with synchronized search params
- **Icons**: Lucide React
- **Date Handling**: Native Date utilities with ISO 8601 formatting

---

## 4. Folder Structure

```
ktea/
├── package.json                   # Root orchestrator scripts (dev, build, lint, test)
├── README.md                      # Comprehensive system documentation
│
├── backend/                       # Express + Prisma REST API
│   ├── .env                       # Local environment configuration
│   ├── .env.example               # Template environment configuration
│   ├── package.json               # Backend dependencies and scripts
│   ├── tsconfig.json              # TypeScript compilation configuration
│   ├── prisma/
│   │   ├── schema.prisma          # Database models, relations & indexes
│   │   └── seed.ts                # Seed script with realistic demo data
│   ├── src/
│   │   ├── app.ts                 # Express application setup, CORS & routes
│   │   ├── index.ts               # Server entry point & graceful shutdown
│   │   ├── config/                # Environment & business settings configs
│   │   ├── controllers/           # HTTP controllers & status code handling
│   │   ├── engine/                # Recommendation Engine & Rules (PHASE 1)
│   │   │   ├── types.ts           # CustomerFeatures, Rule interfaces
│   │   │   ├── featureExtractor.ts# Customer to feature extraction pipeline
│   │   │   ├── rules.ts           # Rule A, B, C, D, E implementations
│   │   │   └── ruleEngine.ts      # Engine evaluator & scoring coordinator
│   │   ├── middlewares/           # Request validation & centralized error handler
│   │   ├── repositories/          # Prisma database query access layer
│   │   ├── routes/                # Modular Express route definitions
│   │   ├── services/              # Core business logic services
│   │   ├── tests/                 # Automated domain & API verification suites
│   │   │   ├── verify-domain.ts   # Domain models & cascade delete verification
│   │   │   ├── verify-api.ts      # REST API endpoints & validation checks
│   │   │   ├── verify-analytics.ts# Calculation reconciliation & definitions
│   │   │   ├── verify-dashboard.ts# Operational dashboard aggregation tests
│   │   │   ├── verify-recommendation-engine.ts # Rule engine assertions
│   │   │   └── verify-settings.ts # Settings & data governance verification
│   │   └── validations/           # Zod schemas for input validation
│
└── frontend/                      # React 18 + Vite SPA
    ├── .env                       # Local frontend environment
    ├── .env.example               # Template frontend environment
    ├── package.json               # Frontend dependencies and scripts
    ├── vite.config.ts             # Vite configuration with proxy settings
    ├── tailwind.config.js         # Theme extensions, palettes & fonts
    ├── src/
    │   ├── App.tsx                # App routes, Layout wrapper & QueryClient
    │   ├── main.tsx               # DOM root mount
    │   ├── components/            # Reusable UI primitives & common components
    │   │   ├── common/            # DataTable, Pagination, StatCard, Badge, etc.
    │   │   └── ui/                # Button, Modal, Card, Skeleton, ConfirmDialog
    │   ├── features/              # Feature-scoped components & modals
    │   │   ├── customers/         # CreateCustomer, EditFollowUp, Modals
    │   │   ├── dashboard/         # ImportDataModal, QuickFollowUpModal
    │   │   ├── push/              # RecommendationCard, PushModal, OutcomeModal
    │   │   └── settings/          # ProductModal, NeedCategoryModal, TagModal
    │   ├── hooks/                 # TanStack Query custom hooks
    │   ├── layouts/               # AppLayout, Sidebar, TopBar navigation
    │   ├── pages/                 # Full-page route views
    │   │   ├── DashboardPage.tsx  # Daily operational command center
    │   │   ├── CustomersPage.tsx  # Scannable customer registry with URL sync
    │   │   ├── CustomerDetailPage.tsx # 360° client profile and pipelines
    │   │   ├── FollowUpsPage.tsx  # Today, Overdue, Upcoming follow-up manager
    │   │   ├── PushPage.tsx       # Recommendation & Referral Push Center
    │   │   ├── AnalyticsPage.tsx  # Descriptive analytics & trends
    │   │   └── SettingsPage.tsx   # System config, tags, and data governance
    │   ├── services/              # Axios HTTP client wrappers
    │   ├── types/                 # Shared TypeScript models & DTOs
    │   └── utils/                 # Formatting, date categorization helpers
```

---

## 5. Database Setup

1. **Install MariaDB or MySQL** (port `3306` by default).
2. **Create the database**:
   ```sql
   CREATE DATABASE crm_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. **Verify access**: Ensure your database credentials match `DATABASE_URL` in `backend/.env`.

---

## 6. Environment Variables

### Backend (`backend/.env`)
```bash
PORT=5000
NODE_ENV=development
DATABASE_URL="mysql://root:@localhost:3306/crm_db"
FRONTEND_API_URL="http://localhost:5173"
CORS_ORIGIN="http://localhost:5173"
```

### Frontend (`frontend/.env`)
```bash
VITE_API_BASE_URL="http://localhost:5000/api"
FRONTEND_API_URL="http://localhost:5173"
```

---

## 7. Development Commands

Run all services concurrently from the root directory:
```bash
# Install root dependencies
npm install

# Install backend and frontend dependencies
cd backend && npm install
cd ../frontend && npm install
cd ..

# Run backend (port 5000) and frontend (port 5173) together:
npm run dev

# Or run services individually:
npm run dev:backend
npm run dev:frontend
```

---

## 8. Migration Commands

Database schema migrations are managed via Prisma:

```bash
cd backend

# Validate schema integrity
npx prisma validate

# Push schema changes directly to the database (development mode):
npx prisma db push

# Generate Prisma Client:
npx prisma generate

# Check migration status:
npx prisma migrate status
```

---

## 9. Seed Commands

Populate the database with realistic business scenarios (35 customers, multi-product application histories, needs, touchpoints, follow-ups, and recommendations):

```bash
cd backend
npm run db:seed
```

---

## 10. Build & Test Commands

### Run Full Automated Test Suite (169 Tests)
```bash
# From root:
npm test

# Or from backend:
cd backend
npm test
```

### Individual Verification Suites
```bash
cd backend
npm run test:domain          # 13 tests: Domain models, relationships, cascades
npm run test:api             # 31 tests: HTTP contracts, status codes, 409 duplicates
npm run test:analytics       # 57 tests: Reconciled counts, approval rate, push success rate
npm run test:recommendations # 26 tests: Rules A-F, deterministic scoring, signal guards
npm run test:dashboard       # 17 tests: Dashboard aggregations & priority metrics
npm run test:settings        # 25 tests: Settings mutations, governance & data export
```

### Code Linting
```bash
# Run both frontend and backend linter:
npm run lint

# Backend only:
npm run lint:backend

# Frontend only:
npm run lint:frontend
```

### Production Builds
```bash
# Build both backend and frontend:
npm run build

# Output:
#   backend/dist/     -> Compiled CommonJS Node.js bundle
#   frontend/dist/    -> Optimized Vite production static assets
```

---

## 11. API Overview

All API endpoints return standard JSON responses with `{ success: true, data: ... }` on success, or `{ success: false, error: string, details?: ... }` on error.

| Group | Method | Endpoint | Description |
|---|---|---|---|
| **Health** | `GET` | `/api/health` | Service and database ping |
| **Customers** | `GET` | `/api/customers` | Paginated search & filtering |
| | `POST` | `/api/customers` | Create customer (409 on duplicate phone) |
| | `GET` | `/api/customers/:id` | Full 360° profile with child relations |
| | `PUT` | `/api/customers/:id` | Update profile fields |
| | `DELETE` | `/api/customers/:id` | Cascading deletion |
| **Needs** | `POST` | `/api/needs` | Declare customer intent / need |
| | `PUT` | `/api/needs/:id` | Update need status (RESOLVED/DROPPED) |
| **Cases** | `POST` | `/api/cases` | Open product application case |
| | `PUT` | `/api/cases/:id` | Update status (APPROVED, REJECTED, etc.) |
| **Activities** | `POST` | `/api/customers/:id/activities` | Record touchpoint (CALL, MEETING, etc.) |
| **Follow-ups** | `GET` | `/api/follow-ups` | Filter reminders (today, overdue, upcoming) |
| | `POST` | `/api/follow-ups` | Schedule follow-up task |
| | `PUT` | `/api/follow-ups/:id` | Update or mark COMPLETED |
| **Recommendations**| `GET` | `/api/recommendations` | List candidate recommendations |
| | `POST` | `/api/recommendations/generate` | Trigger rule evaluation engine |
| | `POST` | `/api/recommendations/:id/dismiss` | Dismiss recommendation match |
| | `POST` | `/api/recommendations/:id/convert-to-push`| Convert opportunity to Referral Push |
| **Push Records** | `GET` | `/api/push-records` | List push history & status |
| | `PUT` | `/api/push-records/:id` | Record referral outcome (SUCCESS/FAILED) |
| **Analytics** | `GET` | `/api/analytics/overview` | Descriptive overview metrics & date filtering |
| | `GET` | `/api/analytics/customers` | Customer cohort acquisition & status splits |
| | `GET` | `/api/analytics/cases` | Case pipeline velocity & approval ratios |
| | `GET` | `/api/analytics/needs` | Needs breakdown & product correlation |
| | `GET` | `/api/analytics/push` | Referral conversion & terminal success rate |
| **Dashboard** | `GET` | `/api/dashboard` | Aggregated daily operational workspace |
| **Governance** | `GET` | `/api/data/status` | Database health & backup guidance |
| | `GET` | `/api/data/export` | Complete or filtered database JSON bundle |

---

## 12. Business Concepts

```
 Customer Profile
  ├── Needs (Identified Intent: "Looking for $20,000 personal loan")
  ├── Cases (Actual Application: Submitted to Underwriting -> Approved/Rejected)
  ├── Recommendations ("System identifies a deterministic cross-sell or recovery match")
  │       │
  │       ▼ [Operator Review & Decision]
  └── Referral Push ("Operator explicitly refers customer to partner institution")
          │
          ▼ [Partner Feedback]
      Push Outcome (SUCCESS / FAILED with reason)
```

1. **Customer 360° Context**: A customer is not merely an address or telephone number. They are a continuous financial journey of identified needs, past loan/card applications, and interaction timestamps.
2. **Need vs. Case**:
   - A **Need** is a customer's stated intent or financial desire (*e.g., need for home improvement financing*).
   - A **Case** is a concrete product application with an institution that moves through stages (`DRAFT` → `SUBMITTED` → `APPROVED` / `REJECTED`).
3. **Recommendation vs. Referral Push**:
   - **Recommendation**: An automated, rule-based inference that a customer is a strong candidate for a product.
   - **Referral Push**: The deliberate operational act of referring that client to a lender or product team. Decoupling ensures operators make informed decisions with full auditability.
4. **Operator-in-the-Loop**: The algorithm never triggers an external referral automatically. Recommendations require operator inspection, and can be reviewed, dismissed, or pushed with custom notes.

---

## 13. Recommendation Engine Explanation

The recommendation engine in **Phase 1** is strictly rule-based, deterministic, and fully transparent. It executes six core rules:

| Rule | Trigger Condition | Target Product | Base Score |
|---|---|---|---|
| **Rule A** (`RULE_A_ACTIVE_LOAN_NEED`) | Customer has an active need for loan products (`PERSONAL_LOAN`, `BUSINESS_FINANCING`, `MORTGAGE`). | Unsecured / Secured Loan | 75 |
| **Rule B** (`RULE_B_EXPLICIT_CARD_INTEREST`) | Customer recorded explicit interest in credit cards (`CREDIT_CARD`). | Rewards / Cashback Card | 70 |
| **Rule C** (`RULE_C_CROSS_PRODUCT_NEED`) | Existing approved cardholder who recently declared an active loan need. | Flexi Personal Loan | 80 |
| **Rule D** (`RULE_D_FAILED_APP_RECOVERY`) | Prior application declined (`REJECTED`) within 90 days, but customer has an active alternate need. | Recovery / Alternative Product | 85 |
| **Rule E** (`RULE_E_RECENCY_BOOST`) | Customer interacted within the last 14 days (call, meeting, or message). | Modifies score by `+10` | N/A |
| **Rule F** (`RULE_F_NO_SIGNAL_GUARD`) | Customer has no active needs and no application history. | **Suppresses all matches** (zero recommendations) | 0 |

### Deterministic Scoring Formula
$$\text{Score} = \min\left(\text{Base Score} + \text{Recency Modifier}, \text{Max Normalized Score (95)}\right)$$

- **Deterministic**: The same customer state evaluated 100 times always produces the exact same score and reason.
- **Explainability**: Every candidate is returned with a transparent reason string and an array of contributing factual signals (*e.g., "Prior application for Titanium Card was declined, but customer has an active alternate need for PERSONAL LOAN. Customer engaged 1 day(s) ago"*).
- **Duplicate Suppression**: Customers with existing active recommendations or in-flight referral pushes are excluded from duplicate suggestions.

---

## 14. Future Machine Learning Extension Points

The recommendation engine was designed from Day 1 with an extensible architecture to support predictive Machine Learning models in **Phase 2**:

1. **`IRecommendationEngine` Interface**:
   ```typescript
   export interface IRecommendationEngine {
     evaluate(
       features: CustomerFeatures,
       availableProducts: Product[],
       config?: any
     ): RecommendationCandidate[];
   }
   ```
2. **Feature Extraction Pipeline (`CustomerFeatures`)**:
   The `featureExtractor.ts` module pre-computes normalized customer attributes (`daysSinceLastActivity`, `applicationHistory`, `activeNeeds`, `priority`). An ML model (such as an XGBoost or Random Forest classifier) can consume this exact feature vector as an input tensor.
3. **Shadow Testing / Hybrid Scoring Pattern**:
   A future `MLRecommendationEngine` or `HybridRecommendationEngine` can run in shadow mode alongside the rule-based engine:
   $$\text{Final Score} = w_1 \cdot \text{RuleScore} + w_2 \cdot P(\text{Acceptance} \mid \text{Features})$$
   Without breaking existing controllers, database tables, or frontend components.

---

## Final Production Checklist

- [x] **Zero TypeScript Errors**: Both frontend and backend compile cleanly.
- [x] **Zero ESLint Errors**: Code adheres to strict linting constraints.
- [x] **169 Automated Tests Passing**: Comprehensive domain, API, analytics, and recommendation suites.
- [x] **Data Integrity**: Referential integrity, cascade deletes, and foreign keys verified.
- [x] **Database Constraints**: Multi-column indexes and uniqueness constraints verified.
- [x] **Sanitization & Security**: Server-side Zod validation on every input; file size & format guards.
- [x] **Production Build Artifacts**: Successfully bundled and verified.
#   K T E A - Q U A N - L Y  
 