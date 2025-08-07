# NADSA GHL Client Manager Brownfield Enhancement PRD

### Change Log

| Change | Date | Version | Description | Author |
| --- | --- | --- | --- | --- |
| Created | 2025-08-07 | 1.0 | Initial draft of Brownfield PRD | John (PM) |

## Intro Project Analysis and Context

### Available Documentation Analysis

A comprehensive `brownfield-architecture.md` document exists and serves as the primary source of technical documentation. It covers:

* **Tech Stack**: Complete list of technologies and versions.
* **Source Tree/Architecture**: Detailed project structure and key module descriptions.
* **API Documentation**: Key internal and external API endpoints.
* **Technical Debt**: Known issues and workarounds are clearly documented.

### Enhancement Scope Definition

* **Enhancement Type**: New Feature Addition & Major Feature Modification (Security).
* **Enhancement Description**: The enhancement involves creating a Membership Reconciliation Dashboard to streamline payment verification from Lloyds Bank and Stripe, overhauling the security and authentication system, and integrating with WordPress to automate member role management.
* **Impact Assessment**: **Significant Impact**, as this involves a major new feature, foundational security changes, and a new external system integration.

### Goals and Background Context

* **Goals**: To reduce administrative reconciliation time by over 90%; improve membership data accuracy in GHL and WordPress to over 99%; eliminate revenue loss from incorrect benefit assignment; and implement a robust, secure authentication and data handling foundation.
* **Background Context**: The current manual reconciliation process is error-prone, leading to inaccurate member data in GHL. This inaccuracy directly impacts member benefits managed in WordPress, causing revenue loss and a poor member experience. This project replaces that manual process with a secure, reliable, and semi-automated dashboard.

---
## Requirements

### Functional Requirements

1.  **FR1 (Security Overhaul)**: The application's authentication system must be upgraded to include brute-force protection (e.g., account lockout after multiple failed login attempts) and security notifications.
2.  **FR2 (Bank CSV Import)**: The dashboard must provide a feature for an administrator to upload a CSV file exported from Lloyds Bank.
3.  **FR3 (Stripe Report Import)**: The dashboard must provide a feature for an administrator to upload a transaction report exported from Stripe.
4.  **FR4 (Smart Matching UI)**: For bank CSV data, the system must display each payment and suggest potential member matches from GHL based on the payer's name and payment amount.
5.  **FR5 (Match Confirmation)**: An administrator must be able to confirm a suggested match with a single action (e.g., clicking a button).
6.  **FR6 (GHL Update)**: Upon match confirmation, the system must automatically update the corresponding contact record in GHL (e.g., set `Renewal Date`, add a `Paid` tag).
7.  **FR7 (WordPress Role Update)**: Upon match confirmation, the system must automatically update the corresponding user's role in WordPress to grant or revoke member benefits.

### Non-Functional Requirements

1.  **NFR1 (Data Privacy - Balance)**: The `Balance` field from any imported bank CSV must be discarded immediately after processing and must **never** be stored in the database or logs.
2.  **NFR2 (Data Privacy - Account Number)**: Bank account numbers from any imported bank CSV must be immediately hashed. The original value must be discarded, and only the hash may be stored for future matching.
3.  **NFR3 (Performance)**: The dashboard's reconciliation interface must be responsive, with user actions completing in under 200ms.
4.  **NFR4 (Usability)**: An administrator must be able to process a typical monthly batch of payments from both sources in under 30 minutes.

### Compatibility Requirements

1.  **CR1 (Existing Functionality)**: The new dashboard and its related processes must not negatively impact or break any existing functionality of the NADSA GHL Client Manager.
2.  **CR2 (GHL API)**: All interactions with the GHL API must be compatible with its current version and stay within its rate limits. The local PostgreSQL database should continue to be used as a cache to minimize API calls.
3.  **CR3 (WordPress Integration)**: The solution must be compatible with WordPress v6.8.2 and operate correctly with the Wordfence security plugin active.

---
## User Interface Enhancement Goals

### Integration with Existing UI

The new Membership Reconciliation Dashboard must seamlessly integrate with the existing application. All new components will be built using the established frontend stack of **React 18** and **Tailwind CSS 3.4.1**. Where possible, existing shared components from the `src/components/` directory should be reused to maintain visual and interactive consistency.

### Modified/New Screens and Views

* **New Screen: Reconciliation Dashboard**: A new, admin-only page will be created to house the dashboard. This screen will contain the UI for uploading both the Lloyds Bank CSV and the Stripe transaction report, displaying the list of unreconciled payments, and presenting the "smart suggestions" for matching.
* **Modified Navigation**: A link to the new dashboard must be added to the main application navigation, visible only to users with an "admin" role.

### UI Consistency Requirements

All new UI elements must adhere to the existing visual style defined in `tailwind.config.js` and `src/app/globals.css`. The dashboard must fully support the application's existing dark mode functionality. Interactive elements like buttons, forms, and tables on the new dashboard must match the style and behavior of existing components throughout the application.

---
## Technical Constraints and Integration Requirements

### Existing Technology Stack

The enhancement must be developed using the project's existing technology stack to ensure compatibility and maintainability. This includes:
* **Languages & Frameworks**: TypeScript 5.9.2, Next.js 14.2.31, React 19.1.1, NextAuth 4.24.11
* **Database**: PostgreSQL with Prisma 6.13.0
* **Styling**: Tailwind CSS v4.1.11
* **External Dependencies**: The solution must integrate with the GoHighLevel API and the new WordPress REST API.

### Integration Approach

* **Database Integration**: Any new data models must be created via Prisma migrations and be backward-compatible with the existing schema.
* **API Integration**: New backend logic will be exposed via new Next.js API routes (e.g., `/api/reconciliation/`). A new service for the WordPress integration will be created in the `src/lib/` directory.
* **Frontend Integration**: The new dashboard will be created as a new protected route within the Next.js App Router. It will consume the new internal API routes.
* **Testing Integration Strategy**: Given the current lack of automated tests, all new backend and frontend components created for this enhancement **must** be accompanied by unit and/or integration tests. The goal is to establish a testing foundation for future development and ensure the new features are reliable.

### Code Organization and Standards

* **File Structure**: New code must follow the existing project structure. For example, dashboard components should reside in `src/app/admin/reconciliation/` and `src/components/reconciliation/`.
* **Coding Standards**: All new TypeScript code must be written in strict mode and pass all ESLint rules. A key goal of this project is to improve code quality, not perpetuate existing technical debt.

### Deployment and Operations

* **Deployment**: The enhancement will be deployed via the existing Vercel integration pipeline.
* **Configuration**: All new secrets (e.g., WordPress API keys, new authentication secrets) must be managed via environment variables, consistent with the current setup.

### Risk Assessment and Mitigation

* **Technical Risk**: The existing build process, which ignores TypeScript/ESLint errors, must be addressed as part of the security overhaul before the new dashboard is deployed.
* **Integration Risk**: The new WordPress integration is a primary risk due to the Wordfence plugin and WPX hosting environment. This will require dedicated research and testing in a staging environment.
* **Lack of Existing Tests**: The absence of an existing automated test suite means regression testing for the current application functionality will be entirely manual and potentially unreliable, increasing the risk of introducing bugs into the old codebase.

---
## Epic and Story Structure

### Epic Approach

This enhancement will be structured as a single, comprehensive epic titled "Membership Reconciliation and Security Overhaul". The core features—Security, the Reconciliation Dashboard, and WordPress Integration—are tightly coupled. A single epic ensures a coordinated implementation and a cohesive release that delivers the full business value at once.

### Epic 1: Membership Reconciliation and Security Overhaul

**Epic Goal**: To replace the manual membership reconciliation process with a secure, semi-automated dashboard that ensures data accuracy in both GHL and WordPress, thereby protecting revenue and improving the member experience.

#### Proposed Story Sequence

1.  **Story 1.1 (Security)**: Implement brute-force protection (e.g., account lockout) for the NextAuth authentication system.
2.  **Story 1.2 (Security)**: Implement security notifications to alert admins of suspicious login activity.
3.  **Story 1.3 (Backend)**: Update the Prisma schema to support the secure storage of hashed bank account numbers.
4.  **Story 1.4 (Backend)**: Develop a backend service to parse the Lloyds Bank and Stripe CSV files, enforcing the required data privacy rules (discarding balances, hashing account numbers).
5.  **Story 1.5 (Backend)**: Create the "smart matching" logic that takes parsed payment data and suggests potential GHL contact matches.
6.  **Story 1.6 (Backend)**: Build the API endpoints required for the dashboard (e.g., file upload, get suggestions, confirm match).
7.  **Story 1.7 (Backend)**: Implement the GHL and WordPress update services that are triggered upon a successful match confirmation.
8.  **Story 1.8 (Frontend)**: Create the basic UI shell for the new admin-only Reconciliation Dashboard page, including its navigation link.
9.  **Story 1.9 (Frontend)**: Build the file upload components for both the Lloyds and Stripe reports.
10. **Story 1.10 (Frontend)**: Develop the main interactive UI that displays payment data, lists the "smart suggestions" from the API, and allows the administrator to confirm matches.
11. **Story 1.11 (Testing)**: Create end-to-end integration tests for the entire reconciliation workflow.

