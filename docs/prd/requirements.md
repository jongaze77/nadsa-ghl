# Requirements

## Functional Requirements

1.  **FR1 (Security Overhaul)**: The application's authentication system must be upgraded to include brute-force protection (e.g., account lockout after multiple failed login attempts) and security notifications.
2.  **FR2 (Bank CSV Import)**: The dashboard must provide a feature for an administrator to upload a CSV file exported from Lloyds Bank.
3.  **FR3 (Stripe Report Import)**: The dashboard must provide a feature for an administrator to upload a transaction report exported from Stripe.
4.  **FR4 (Smart Matching UI)**: For bank CSV data, the system must display each payment and suggest potential member matches from GHL based on the payer's name and payment amount.
5.  **FR5 (Match Confirmation)**: An administrator must be able to confirm a suggested match with a single action (e.g., clicking a button).
6.  **FR6 (GHL Update)**: Upon match confirmation, the system must automatically update the corresponding contact record in GHL (e.g., set `Renewal Date`, add a `Paid` tag).
7.  **FR7 (WordPress Role Update)**: Upon match confirmation, the system must automatically update the corresponding user's role in WordPress to grant or revoke member benefits.

## Non-Functional Requirements

1.  **NFR1 (Data Privacy - Balance)**: The `Balance` field from any imported bank CSV must be discarded immediately after processing and must **never** be stored in the database or logs.
2.  **NFR2 (Data Privacy - Account Number)**: Bank account numbers from any imported bank CSV must be immediately hashed. The original value must be discarded, and only the hash may be stored for future matching.
3.  **NFR3 (Performance)**: The dashboard's reconciliation interface must be responsive, with user actions completing in under 200ms.
4.  **NFR4 (Usability)**: An administrator must be able to process a typical monthly batch of payments from both sources in under 30 minutes.

## Compatibility Requirements

1.  **CR1 (Existing Functionality)**: The new dashboard and its related processes must not negatively impact or break any existing functionality of the NADSA GHL Client Manager.
2.  **CR2 (GHL API)**: All interactions with the GHL API must be compatible with its current version and stay within its rate limits. The local PostgreSQL database should continue to be used as a cache to minimize API calls.
3.  **CR3 (WordPress Integration)**: The solution must be compatible with WordPress v6.8.2 and operate correctly with the Wordfence security plugin active.

---