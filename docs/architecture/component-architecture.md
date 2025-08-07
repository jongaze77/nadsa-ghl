# Component Architecture

## New Components

### Backend Services (in `src/lib/`)

  * **`ReconciliationService.ts`**: Orchestrates the entire reconciliation process.
  * **`CsvParsingService.ts`**: Parses uploaded CSVs and applies data privacy rules.
  * **`MatchingService.ts`**: Contains the "smart matching" logic against GHL contacts.
  * **`WordPressService.ts`**: A new client for the WordPress REST API.
  * **`AuthService.ts` (enhancements)**: Modifications to add brute-force protection.

### API Routes (in `src/app/api/reconciliation/`)

  * **`upload/route.ts`**: Handles file uploads.
  * **`matches/route.ts`**: Provides smart match suggestions to the frontend.
  * **`confirm/route.ts`**: Receives a confirmed match and triggers updates.

### Frontend Components (in `src/components/reconciliation/`)

  * **`ReconciliationDashboard.tsx`**: The main parent component for the new page.
  * **`FileUpload.tsx`**, **`PaymentList.tsx`**, **`MatchSuggestions.tsx`**: UI components for the dashboard workflow.

## Component Interaction Diagram

```mermaid
sequenceDiagram
    participant Admin
    participant Frontend
    participant API
    participant Backend Services
    participant GHL/WordPress

    Admin->>Frontend: Uploads CSV File
    Frontend->>API: POST /api/reconciliation/upload
    API->>Backend Services: CsvParsingService.parse(file)
    API-->>Frontend: Shows Payments in UI
    Admin->>Frontend: Selects a Payment to Match
    Frontend->>API: GET /api/reconciliation/matches
    API->>Backend Services: MatchingService.getSuggestions()
    API-->>Frontend: Displays Match Suggestions
    Admin->>Frontend: Clicks "Confirm Match"
    Frontend->>API: POST /api/reconciliation/confirm
    API->>Backend Services: ReconciliationService.confirmMatch()
    Backend Services->>GHL/WordPress: Update Contact Record & User Role
    Backend Services-->>API: Log confirmation in DB
    API-->>Frontend: Shows Success Message
```

