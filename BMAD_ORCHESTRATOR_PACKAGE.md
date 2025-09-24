# BMAD Orchestrator Package - NADSA GHL Client Manager

## Project Status Summary
- **Current Branch**: main
- **Total Stories**: 21 story files in docs/stories/
- **Latest Story**: 2.5 (Mailmerge Data Export) - Status: Done
- **Recent Commit**: 2f1228c - Story 2.5: Complete mailmerge export functionality and renewal date management scripts
- **Modified Files**: docs/stories/2.5.mailmerge-data-export.md (recently marked as Done)

## Epic Progress Overview
- **Epic 1** (Security & Reconciliation): Stories 1.1-1.12 (12 stories) - All completed
- **Epic 2** (Enhancements): Stories 2.1-2.5 (5 stories) - All completed  
- **Next**: Epic 2 is complete, ready for Epic 3 direction or new stories

---

## 1. CORE PROJECT CONFIGURATION

### .bmad-core/core-config.yaml
```yaml
markdownExploder: true
prd:
  prdFile: docs/prd.md
  prdVersion: v4
  prdSharded: true
  prdShardedLocation: docs/prd
  epicFilePattern: epic-{n}*.md
architecture:
  architectureFile: docs/architecture.md
  architectureVersion: v4
  architectureSharded: true
  architectureShardedLocation: docs/architecture
customTechnicalDocuments: null
devLoadAlwaysFiles:
  - docs/architecture/coding-standards.md
  - docs/architecture/tech-stack.md
  - docs/architecture/source-tree.md
devDebugLog: .ai/debug-log.md
devStoryLocation: docs/stories
slashPrefix: BMad
```

---

## 2. PROJECT OVERVIEW (CLAUDE.md)

### Project Type
Next.js 15 application for managing Go High Level (GHL) contacts with authentication, custom field management, and notes functionality.

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Database**: PostgreSQL via Prisma ORM
- **Authentication**: NextAuth with credentials provider, JWT sessions (24h expiry)
- **External API**: GoHighLevel REST API integration with retry logic
- **Styling**: Tailwind CSS with custom high-contrast theme

### Key Components
- Contact Management: CRUD operations with custom fields support
- Authentication Middleware: Role-based access control (admin/user roles)
- GHL Integration: Bidirectional sync with GoHighLevel contacts and custom fields
- Notes System: Contact-specific notes with API endpoints

### Environment Variables Required
```
GHL_API_KEY=your_api_key
GHL_LOCATION_ID=your_location_id
ADMIN_USERNAME=admin_username
ADMIN_PASSWORD=hashed_password
NEXTAUTH_SECRET=random_secret
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL=postgresql_connection_string
```

---

## 3. PACKAGE.JSON DEPENDENCIES

### Core Dependencies
```json
{
  "dependencies": {
    "@prisma/client": "^6.13.0",
    "next": "^15.4.6",
    "next-auth": "^4.24.11",
    "react": "^18.3.1",
    "axios": "^1.11.0",
    "bcryptjs": "^3.0.2"
  },
  "devDependencies": {
    "@playwright/test": "^1.54.2",
    "@testing-library/react": "^16.3.0",
    "jest": "^30.0.5",
    "typescript": "^5.9.2",
    "prisma": "^6.13.0"
  }
}
```

### Key Scripts
- `npm run dev` - Development server
- `npm run build` - Production build (includes Prisma generation)
- `npm run lint` - ESLint
- `npm run type-check` - TypeScript check
- `npm run test` - Combined type-check, lint, and Jest
- `npm run sync-contacts` - GHL contact synchronization

---

## 4. DATABASE SCHEMA (PRISMA)

### Core Models
```prisma
model User {
  id       Int    @id @default(autoincrement())
  username String @unique
  password String
  role     String @default("user")
  createdAt DateTime @default(now())
  failedLoginAttempts Int @default(0)
  lockedUntil DateTime?
  
  securityEvents SecurityEvent[]
  reconciliationLogs ReconciliationLog[]
  pendingPayments PendingPayment[]
}

model Contact {
  id            String   @id
  firstName     String?
  lastName      String?
  email         String? @unique
  phone         String?
  membershipType String?
  
  // Address fields
  address1      String?
  address2      String?
  city          String?
  state         String?
  postalCode    String?
  country       String?
  
  customFields  Json?    // Store all custom fields as JSON
  renewal_date  String?  // Extracted from GHL custom field cWMPNiNAfReHOumOhBB2
  
  // Reconciliation relationships
  paymentSources     PaymentSource[]
  reconciliationLogs ReconciliationLog[]
}

model SecurityEvent {
  id               String   @id @default(cuid())
  eventType        String   // 'failed_login', 'successful_login_after_failures', etc.
  userId           Int?
  username         String
  ipAddress        String
  timestamp        DateTime @default(now())
  severity         String   // 'low', 'medium', 'high', 'critical'
}

model PendingPayment {
  id                      String   @id @default(cuid())
  transactionFingerprint  String   @unique
  paymentDate            DateTime
  amount                 Decimal  @db.Money
  source                 String   // 'BANK_CSV' | 'STRIPE_REPORT'
  status                 String   @default("pending")
  uploadedByUserId       Int
}

model ReconciliationLog {
  id                    String   @id @default(cuid())
  transactionFingerprint String  @unique
  paymentDate           DateTime
  amount                Decimal  @db.Money
  source                String
  reconciledByUserId    Int
  contactId             String
}
```

---

## 5. CURRENT WORKING STATE

### Git Status
```
M docs/stories/2.5.mailmerge-data-export.md
```

### Recent Commits
```
2f1228c Story 2.5: Complete mailmerge export functionality and renewal date management scripts
257e391 Story 2.3b
dd896f2 Story 2.3
04f24fa Merge pull request #7 from jongaze77/debug/issue-6-2025-08-09
450cbab test tweaks and fixes
```

---

## 6. ARCHITECTURE OVERVIEW

### Technology Stack Alignment
- **Framework**: Next.js 14.2.31 (target)
- **UI Library**: React 19.1.1 (target)
- **Database ORM**: Prisma 6.13.0
- **Authentication**: NextAuth 4.24.11
- **Styling**: Tailwind CSS v4.1.11
- **Language**: TypeScript 5.9.2

### New Technology Additions
- **Jest & React Testing Library**: Component and Unit Testing
- **Axios**: HTTP Client for WordPress REST API integration

---

## 7. EPIC STRUCTURE

### Epic 1: Membership Reconciliation and Security Overhaul
**Epic Goal**: Replace manual membership reconciliation with secure, semi-automated dashboard.

**Completed Stories (1.1-1.12)**:
1. Story 1.1: Brute-force protection for NextAuth
2. Story 1.2: Security notifications for suspicious login activity
3. Story 1.3: Prisma schema for hashed bank account storage
4. Story 1.4: Test fixes
5. Story 1.5: CSV parsing service (Lloyds Bank & Stripe)
6. Story 1.6: Smart matching logic for payment suggestions
7. Story 1.7: Dashboard API endpoints
8. Story 1.8: GHL and WordPress update services
9. Story 1.9: Reconciliation Dashboard UI shell
10. Story 1.10: File upload components
11. Story 1.11: Main interactive UI for payment matching
12. Story 1.12: End-to-end integration tests

### Epic 2: Enhanced Features (Completed)
**Completed Stories (2.1-2.5)**:
1. Story 2.1: Enhanced surname matching and UI improvements
2. Story 2.2: Enhanced contact edit modal with payment date and notes
3. Story 2.3: Admin data import/export page
4. Story 2.4: Enhanced date format detection and parsing
5. Story 2.5: Mailmerge data export (JUST COMPLETED)

---

## 8. KEY INTEGRATION POINTS

### GHL API Integration
- Location: `src/lib/ghl-api.ts`
- Features: Retry logic, field mapping, bidirectional sync
- Custom field mapping defined in `FIELD_MAP`

### Authentication Middleware
- Location: `src/middleware.ts`
- Features: Route protection, role-based access control

### Database Access
- Location: Prisma client throughout `/api` routes
- Pattern: Standard CRUD operations with transaction support

---

## 9. STORY FILES SUMMARY

**Total Stories**: 21 files in docs/stories/
**Status Distribution**:
- Epic 1 (1.1-1.12): All Done
- Epic 2 (2.1-2.5): All Done

**Latest Completed**: Story 2.5 - Mailmerge Data Export
- Export CSV with name, address, membership type data
- Admin-only functionality with proper authentication
- Comprehensive test coverage included

---

## 10. NEXT STEPS RECOMMENDATIONS

1. **Epic 3 Definition**: Epic 2 is complete - need to define next epic scope
2. **Technical Debt**: Review and address any accumulated technical debt
3. **Testing Coverage**: Ensure comprehensive test coverage across all completed stories
4. **Documentation**: Update any missing documentation for completed features

**Current State**: Ready for Epic 3 planning or additional Story 2.x features based on business priorities.