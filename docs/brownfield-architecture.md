# NADSA GHL Client Manager - Brownfield Architecture Document

## Introduction

This document captures the CURRENT STATE of the NADSA GHL Client Manager codebase, including technical debt, workarounds, and real-world patterns. It serves as a reference for AI agents working on enhancements to this Next.js 15 application that manages GoHighLevel (GHL) contacts with authentication, custom field management, and notes functionality.

### Document Scope

Comprehensive documentation of the entire system architecture, patterns, and constraints.

### Change Log

| Date   | Version | Description                 | Author    |
| ------ | ------- | --------------------------- | --------- |
| 2025-08-07 | 1.0     | Initial brownfield analysis | Claude Code |

## Quick Reference - Key Files and Entry Points

### Critical Files for Understanding the System

- **Main Entry**: `src/app/layout.tsx` - Root layout with providers and navigation
- **Configuration**: `next.config.js`, `prisma/schema.prisma`, `tailwind.config.js`
- **Core Business Logic**: `src/lib/ghl-api.ts`, `src/lib/auth.ts`
- **API Definitions**: `src/app/api/**/*.ts` - Next.js App Router API routes
- **Database Models**: `prisma/schema.prisma` - User and Contact models
- **Key Algorithms**: 
  - `src/lib/ghl-api.ts:153-189` - GHL to Prisma mapping logic
  - `src/lib/ghl-api.ts:203-274` - Contact change tracking
  - `src/scripts/sync-contacts.ts` - Batch synchronization logic

## High Level Architecture

### Technical Summary

This is a Next.js 15 application using the App Router pattern with PostgreSQL database via Prisma ORM. It serves as a bridge between GoHighLevel CRM and local contact management, with role-based authentication and custom field handling for NADSA membership management.

### Actual Tech Stack (from package.json)

| Category  | Technology | Version | Notes                      |
| --------- | ---------- | ------- | -------------------------- |
| Runtime   | Node.js    | 18+     | Required for Next.js 15    |
| Framework | Next.js    | 15.1.0  | App Router, standalone output |
| Database  | PostgreSQL | Any     | Via Prisma ORM             |
| ORM       | Prisma     | 6.9.0   | Client generation required |
| Auth      | NextAuth   | 4.24.11 | JWT sessions, 24h expiry   |
| UI        | React      | 18      | With Tailwind CSS          |
| Styling   | Tailwind   | 3.4.1   | Dark mode media query      |
| Password  | bcryptjs   | 3.0.2   | For credential hashing     |
| HTTP      | node-fetch | 3.3.2   | For GHL API calls          |
| Tools     | TypeScript | 5.3.3   | Strict mode enabled        |

### Repository Structure Reality Check

- Type: Single repository (monorepo-style with scripts)
- Package Manager: npm (package-lock.json present)
- Notable: Uses `@/` path alias for `src/` directory
- Build: Standalone output for Vercel deployment

## Source Tree and Module Organization

### Project Structure (Actual)

```text
ghl-client-manager/
├── src/
│   ├── app/                 # Next.js 15 App Router
│   │   ├── api/            # API routes (REST endpoints)
│   │   │   ├── auth/       # NextAuth endpoints
│   │   │   ├── contacts/   # Contact CRUD operations
│   │   │   ├── contact/    # Individual contact operations
│   │   │   ├── notes/      # Notes management
│   │   │   ├── users/      # User management (admin only)
│   │   │   └── webhooks/   # GHL webhook handlers
│   │   ├── contacts/       # Contact management UI
│   │   ├── users/          # User management UI (admin only)
│   │   ├── login/          # Authentication pages
│   │   ├── layout.tsx      # Root layout with providers
│   │   └── globals.css     # Tailwind base styles
│   ├── components/         # Reusable React components
│   ├── lib/                # Core business logic
│   │   ├── ghl-api.ts      # GHL API integration (CRITICAL)
│   │   ├── auth.ts         # NextAuth configuration
│   │   ├── prisma.ts       # Database client
│   │   └── *.ts           # Utilities and hooks
│   ├── middleware.ts       # Route protection logic
│   ├── scripts/            # Database and sync scripts
│   └── types/              # TypeScript definitions
├── prisma/
│   ├── schema.prisma       # Database schema (User, Contact)
│   ├── migrations/         # Database migrations
│   └── seed.js            # Database seeding
├── docs/                   # Documentation (this file)
├── public/                 # Static assets
└── [config files]         # Various configuration files
```

### Key Modules and Their Purpose

- **GHL API Integration**: `src/lib/ghl-api.ts` - Handles all GoHighLevel API operations with retry logic
- **Authentication**: `src/lib/auth.ts` + `src/middleware.ts` - JWT-based auth with role-based access
- **Contact Management**: `src/app/api/contacts/` - CRUD operations with search and pagination
- **Database Layer**: `src/lib/prisma.ts` + `prisma/schema.prisma` - PostgreSQL via Prisma
- **Synchronization**: `src/scripts/sync-contacts.ts` - Batch sync from GHL to local DB
- **UI Components**: `src/components/` - React components for contact editing and management

## Data Models and APIs

### Data Models

**User Model** (see `prisma/schema.prisma:16-22`):
- `id` (Int, auto-increment)
- `username` (String, unique)
- `password` (String, bcrypt hashed)
- `role` (String, default "user")
- `createdAt` (DateTime)

**Contact Model** (see `prisma/schema.prisma:24-49`):
- `id` (String, GHL contact ID)
- Standard fields: `firstName`, `lastName`, `email`, `phone`, etc.
- GHL fields: `name`, `companyName`, `address1-2`, `city`, `state`, etc.
- `membershipType` (String, extracted from custom fields)
- `customFields` (Json, stores all GHL custom fields)
- `tags` (String array)
- Timestamps: `createdAt`, `updatedAt`, `ghlUpdatedAt`, `lastSyncedAt`

### API Specifications

**Key API Endpoints**:
- `GET /api/contacts` - List contacts with search and pagination
- `GET /api/contacts/[id]` - Get individual contact
- `PUT /api/contacts/[id]` - Update contact
- `POST /api/contacts/new` - Create new contact
- `GET|POST /api/contacts/[id]/notes` - Notes management
- `GET /api/users` - User management (admin only)
- `POST /api/webhooks/ghl-contact-created` - GHL webhook handler

**Authentication**:
- `POST /api/auth/signin` - Credential-based login
- `POST /api/auth/signout` - Session termination

## Technical Debt and Known Issues

### Critical Technical Debt

1. **Error Handling**: Build configuration ignores TypeScript and ESLint errors (`next.config.js:3-8`)
   - WARNING: Production builds proceed even with errors
   - Potential runtime failures not caught at build time

2. **GHL API Integration**: Hardcoded field mappings in `FIELD_MAP` (`src/lib/ghl-api.ts:8-21`)
   - Custom field IDs are environment-specific
   - No validation for missing field mappings
   - Manual maintenance required for new custom fields

3. **Contact Sync Logic**: Complex data transformation without proper validation
   - Multiple fallback patterns for contact ID extraction (`src/lib/ghl-api.ts:155-159`)
   - Inconsistent custom field handling (array vs object formats)
   - Change tracking logic is verbose and logs extensively

4. **Database Constraints**: Contact email uniqueness constraint may conflict with GHL data
   - GHL allows duplicate emails, but Prisma schema enforces uniqueness
   - Potential sync failures if duplicate emails exist in GHL

### Workarounds and Gotchas

- **Environment Variables**: GHL API credentials must be set correctly or sync fails silently
- **Database Connection**: Uses connection pooling but pool size not configurable
- **Session Management**: 24-hour JWT expiry is hardcoded (`src/lib/auth.ts:42`)
- **Membership Type**: Complex extraction logic with normalization (`src/lib/ghl-api.ts:116-151`)
- **Retry Logic**: Exponential backoff for GHL API calls with 3 max retries

## Integration Points and External Dependencies

### External Services

| Service  | Purpose  | Integration Type | Key Files                      |
| -------- | -------- | ---------------- | ------------------------------ |
| GoHighLevel | CRM/Contacts | REST API | `src/lib/ghl-api.ts` |
| PostgreSQL | Database | Prisma ORM | `prisma/schema.prisma`, `src/lib/prisma.ts` |

### GHL API Integration Details

- **Base URL**: `https://rest.gohighlevel.com/v1`
- **Authentication**: Bearer token via `GHL_API_KEY` environment variable
- **Rate Limiting**: Handled via retry logic with exponential backoff
- **Custom Fields**: Mapped via hardcoded `FIELD_MAP` object
- **Endpoints Used**:
  - `GET /contacts` - List contacts with pagination
  - `GET /contacts/{id}` - Individual contact details
  - `PUT /contacts/{id}` - Update contact (if needed)

### Internal Integration Points

- **Frontend-Backend**: REST API communication via Next.js API routes
- **Authentication Flow**: NextAuth with credential provider, JWT sessions
- **Database Operations**: Prisma ORM with PostgreSQL connection pooling
- **File Organization**: App Router structure with API routes co-located

## Development and Deployment

### Local Development Setup

1. **Environment Setup**:
   ```bash
   cp .env.example .env.local
   # Configure: DATABASE_URL, GHL_API_KEY, GHL_LOCATION_ID, NEXTAUTH_SECRET, etc.
   ```

2. **Database Setup**:
   ```bash
   npx prisma migrate dev    # Run migrations
   npx prisma generate       # Generate client
   npm run sync-contacts     # Initial data sync
   ```

3. **Development Server**:
   ```bash
   npm install
   npm run dev               # Starts on localhost:3000
   ```

### Build and Deployment Process

- **Build Command**: `npm run build` (includes Prisma generation)
- **Production**: `npm start` (standalone Next.js server)
- **Deployment**: Configured for Vercel with `vercel.json`
- **Runtime**: Node.js runtime for API routes specified in Vercel config

### Environment Variables Required

```bash
# Core Application
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_random_secret_here

# Database
DATABASE_URL=postgresql://username:password@host:port/database

# GoHighLevel Integration
GHL_API_KEY=your_ghl_api_key
GHL_LOCATION_ID=your_location_id

# Authentication
ADMIN_USERNAME=admin_username
ADMIN_PASSWORD=hashed_bcrypt_password  # Use hash-password.js script
```

## Testing Reality

### Current Test Coverage

- **Unit Tests**: None implemented
- **Integration Tests**: None implemented
- **E2E Tests**: None implemented
- **Manual Testing**: Primary QA method
- **Type Checking**: `npm run type-check` (TypeScript compiler)
- **Linting**: `npm run lint` (ESLint with Next.js config)
- **Combined**: `npm run test` runs both type-check and lint

### Quality Assurance

Current quality assurance relies on:
1. TypeScript strict mode compilation
2. ESLint rules (but ignored during builds)
3. Manual testing of UI flows
4. Database migration testing
5. GHL API integration testing via sync script

## Key Business Logic Patterns

### Contact Data Flow

1. **GHL → Local DB**: Sync script fetches from GHL API and maps to Prisma schema
2. **Local Editing**: UI components update local database
3. **Change Tracking**: Detailed logging of field changes for audit purposes
4. **Custom Field Handling**: JSON storage with typed mapping via `FIELD_MAP`

### Authentication & Authorization

- **Credential-based**: Username/password stored in local database
- **Session Management**: JWT tokens with 24-hour expiry
- **Role-based Access**: Admin users can access `/users` routes
- **Route Protection**: Middleware enforces authentication on all non-login routes

### Membership Type Logic

Complex membership type extraction and normalization:
- Extracts from GHL custom field `gH97LlNC9Y4PlkKVlY8V`
- Normalizes values: "Full Member" → "Full", "Associate Member" → "Associate"
- Handles both array and object custom field formats from GHL API

## Deployment Considerations

### Production Configuration

- **Standalone Output**: Next.js configured for standalone deployment
- **Error Tolerance**: Build ignores TypeScript/ESLint errors (RISK)
- **Runtime**: Node.js required for API routes and database operations
- **Vercel Optimized**: Configuration in `vercel.json` for optimal deployment

### Monitoring and Logging

- **Console Logging**: Extensive logging in sync operations and API calls
- **Error Tracking**: Basic console.error for API failures
- **No APM**: No application performance monitoring configured
- **Database Errors**: Specific handling for Prisma connection errors (P1001)

## Security Considerations

### Current Security Measures

- **Password Hashing**: bcryptjs for credential storage
- **JWT Sessions**: Secure token-based authentication
- **Route Protection**: Middleware enforces authentication
- **Role-based Access**: Admin routes protected from regular users
- **HTTPS Headers**: PoweredBy header disabled for security

### Potential Security Concerns

- **Build Errors Ignored**: May allow deployment of vulnerable code
- **API Key Storage**: GHL API key in environment variables (good practice)
- **Session Length**: 24-hour JWT expiry may be too long for sensitive operations
- **No CSRF Protection**: Relies on JWT for request authentication
- **No Rate Limiting**: API routes lack request rate limiting

## Appendix - Useful Commands and Scripts

### Frequently Used Commands

```bash
# Development
npm run dev              # Start development server on :3000
npm run build            # Production build (includes Prisma generation)
npm run start            # Start production server
npm run lint             # Run ESLint
npm run type-check       # TypeScript compilation check
npm run test             # Run both type-check and lint

# Database Operations
npx prisma generate      # Generate Prisma client
npx prisma migrate dev   # Run database migrations
npx prisma db push       # Push schema changes to database
npx prisma studio        # Open Prisma Studio UI

# Data Synchronization
npm run sync-contacts    # Sync contacts from GHL to local database

# Utilities
node hash-password.js    # Generate bcrypt hash for admin password
node check.js           # Database connection check
```

### Debugging and Troubleshooting

- **Database Issues**: Check `DATABASE_URL` connection string format
- **GHL API Errors**: Verify `GHL_API_KEY` and `GHL_LOCATION_ID` are correct
- **Auth Problems**: Ensure `NEXTAUTH_SECRET` is set and `NEXTAUTH_URL` matches deployment URL
- **Build Failures**: Check TypeScript errors with `npm run type-check`
- **Sync Issues**: Review console output from `npm run sync-contacts` for detailed error logs
- **Custom Fields**: Update `FIELD_MAP` in `src/lib/ghl-api.ts` when GHL custom fields change

### Performance Considerations

- **Database Queries**: Contact search uses case-insensitive contains queries
- **Pagination**: Implemented for contact lists (default 100 per page)
- **GHL API**: Retry logic with exponential backoff for reliability
- **Sync Performance**: Processes contacts sequentially to avoid rate limiting
- **Client Generation**: Prisma client regeneration required after schema changes