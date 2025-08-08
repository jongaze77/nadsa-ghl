# Epic and Story Structure

## Epic Approach

This enhancement will be structured as a single, comprehensive epic titled "Membership Reconciliation and Security Overhaul". The core features—Security, the Reconciliation Dashboard, and WordPress Integration—are tightly coupled. A single epic ensures a coordinated implementation and a cohesive release that delivers the full business value at once.

## Epic 1: Membership Reconciliation and Security Overhaul

**Epic Goal**: To replace the manual membership reconciliation process with a secure, semi-automated dashboard that ensures data accuracy in both GHL and WordPress, thereby protecting revenue and improving the member experience.

### Proposed Story Sequence

1.  **Story 1.1 (Security)**: Implement brute-force protection (e.g., account lockout) for the NextAuth authentication system.
2.  **Story 1.2 (Security)**: Implement security notifications to alert admins of suspicious login activity.
3.  **Story 1.3 (Backend)**: Update the Prisma schema to support the secure storage of hashed bank account numbers.
4.  **Story 1.4 (Backend)**: Fixing tests
5.  **Story 1.5 (Backend)**: Develop a backend service to parse the Lloyds Bank and Stripe CSV files, enforcing the required data privacy rules (discarding balances, hashing account numbers).
6.  **Story 1.6 (Backend)**: Create the "smart matching" logic that takes parsed payment data and suggests potential GHL contact matches.
7.  **Story 1.7 (Backend)**: Build the API endpoints required for the dashboard (e.g., file upload, get suggestions, confirm match).
8.  **Story 1.8 (Backend)**: Implement the GHL and WordPress update services that are triggered upon a successful match confirmation.
9.  **Story 1.9 (Frontend)**: Create the basic UI shell for the new admin-only Reconciliation Dashboard page, including its navigation link.
10. **Story 1.10 (Frontend)**: Build the file upload components for both the Lloyds and Stripe reports.
11. **Story 1.11 (Frontend)**: Develop the main interactive UI that displays payment data, lists the "smart suggestions" from the API, and allows the administrator to confirm matches.
12. **Story 1.12 (Testing)**: Create end-to-end integration tests for the entire reconciliation workflow.

