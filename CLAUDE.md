# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 application for managing Go High Level (GHL) contacts with authentication, custom field management, and notes functionality. It uses Prisma with PostgreSQL, NextAuth for authentication, and integrates with the GoHighLevel API.

## Key Commands

### Development
- `npm run dev` - Start development server
- `npm run build` - Build production version (includes Prisma generation)
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript compiler without emitting files
- `npm run test` - Combined type-check and lint (no unit tests currently)

### Database & Scripts
- `npm run sync-contacts` - Sync contacts from GHL API to local database
- `npx prisma generate` - Generate Prisma client
- `npx prisma migrate dev` - Run database migrations
- `npx prisma db push` - Push schema to database

## Architecture

### Core Structure
- **Next.js App Router**: Uses `/src/app` directory structure with API routes
- **Authentication**: NextAuth with credentials provider, JWT sessions (24h expiry)
- **Database**: PostgreSQL via Prisma ORM with User and Contact models
- **External API**: GoHighLevel REST API integration with retry logic
- **Styling**: Tailwind CSS with custom high-contrast theme

### Key Components
- **Contact Management**: CRUD operations for contacts with custom fields support
- **Authentication Middleware**: Role-based access control (admin/user roles)
- **GHL Integration**: Bidirectional sync with GoHighLevel contacts and custom fields
- **Notes System**: Contact-specific notes with API endpoints

### Database Schema
- `User`: Authentication with role-based permissions
- `Contact`: Stores both standard GHL fields and custom fields as JSON
- `SyncOperation`: Tracks automated sync operations with detailed metrics and status
- Custom field mapping defined in `FIELD_MAP` in `src/lib/ghl-api.ts`

### API Architecture
- `/api/auth/[...nextauth]` - NextAuth endpoints
- `/api/contacts/*` - Contact CRUD operations
- `/api/contact/[id]/*` - Individual contact operations
- `/api/sync/incremental` - Automated hourly incremental sync endpoint (cron)
- `/api/sync/full` - Automated daily full reconciliation sync endpoint (cron)
- `/api/sync/status` - Real-time sync status monitoring endpoint
- `/api/webhooks/ghl-contact-created` - GHL webhook handler

### Important Files
- `src/lib/ghl-api.ts` - GHL API integration with retry logic and field mapping
- `src/lib/auth.ts` - NextAuth configuration
- `src/middleware.ts` - Route protection and role-based access
- `prisma/schema.prisma` - Database schema
- `src/scripts/sync-contacts.ts` - Contact synchronization script

### Environment Variables Required
```
GHL_API_KEY=your_api_key
GHL_LOCATION_ID=your_location_id
ADMIN_USERNAME=admin_username
ADMIN_PASSWORD=hashed_password
NEXTAUTH_SECRET=random_secret
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL=postgresql_connection_string
CRON_SECRET=your_cron_secret (optional, for additional auth on cron endpoints)
```

### Custom Field Handling
- Custom fields are stored as JSON in the `customFields` column
- Field mapping between GHL field IDs and form keys in `FIELD_MAP`
- Membership type extraction with normalization logic
- Change tracking for contact updates

### Automated Sync System
- **Incremental Sync**: Runs hourly via Vercel cron, fetches only contacts modified since last sync using GHL API `updatedAt[gt]` parameter
- **Full Reconciliation**: Runs daily at 2 AM via Vercel cron, processes all contacts for complete data integrity
- **Sync Monitoring**: Real-time status indicator in navigation shows sync health (Green/Yellow/Red based on last sync time)
- **Operation Tracking**: All sync operations logged to `SyncOperation` model with detailed metrics and error tracking
- **Authentication**: Cron endpoints secured with Vercel user-agent detection and optional `CRON_SECRET` bearer token
- **Manual Fallback**: Original `npm run sync-contacts` script remains fully functional for manual operations

### Development Notes
- TypeScript errors and ESLint errors are ignored during builds (see `next.config.js`)
- Uses `@/` path alias for `src/` directory
- Contact sync includes detailed logging for debugging
- Retry logic implemented for GHL API calls with exponential backoff
- Vercel cron jobs configured in `vercel.json` for automated sync scheduling (requires Vercel Pro plan)
- Sync status UI component provides detailed operation history and metrics