## Project Brief: NADSA GHL Client Manager Enhancement

### Executive Summary

This project will introduce a Membership Reconciliation Dashboard for the NADSA GHL Client Manager. The dashboard will streamline the currently manual and untracked process of verifying annual membership payments from two distinct sources: Lloyds Bank statements (via CSV) and Stripe (via transaction reports).

The primary problem is the lack of a reliable system to track renewals, leading to inaccurate membership statuses and a significant administrative burden. The target users are the NADSA administrators responsible for membership management. The key value proposition is to automate and simplify payment verification, create a clear audit trail, and ensure the membership data in GHL is accurate, all while implementing robust security for handling sensitive financial data.

### Problem Statement

While the existing custom-built application provides a more user-friendly interface for administering membership details than GHL's native tools, its effectiveness is undermined by the unreliability of the underlying membership and payment data. The process for tracking annual membership renewals for NADSA is entirely manual and lacks a systematic workflow. Administrators must cross-reference bank statements from Lloyds and payment reports from Stripe against the contact list in GoHighLevel (GHL). There is no existing mechanism to flag members who are due for renewal, track who has been checked, or automatically update the status of members who have failed to pay.

This manual process is time-consuming and highly susceptible to human error, which leads to inaccurate membership data in GHL. This inaccuracy directly impacts member benefits, as Single and Double members are entitled to reduced ticket prices via a user role in a separate WordPress system. Consequently, members who have not renewed may still be receiving discounts, leading to lost revenue, while newly paid-up members may not receive their benefits promptly, creating a poor member experience. The current solution—manual reconciliation—falls short as it lacks the reliability, efficiency, and scalability needed to manage these critical, time-sensitive benefits.

The urgency of solving this problem is heightened by the need to handle member data—including sensitive transaction information—in a more secure and professional manner. Implementing a robust, auditable system is crucial for maintaining accurate records, ensuring fairness for all members, and reducing the significant administrative burden on the team.

### Proposed Solution

The proposed solution is the development of a new **Membership Reconciliation Dashboard** within the existing NADSA GHL Client Manager application. This dashboard will provide a centralized interface for administrators to reconcile annual membership payments. It will feature two distinct workflows to handle the different payment sources: a CSV import for Lloyds Bank statements and a separate import for detailed Stripe transaction reports. The core of the solution is a 'smart matching' system that will suggest potential member matches for each transaction, allowing for a simple, one-click confirmation process.

This solution will replace the current manual, error-prone process with a purpose-built, semi-automated workflow. Its success will be driven by providing a reliable, auditable, and efficient method for updating membership data. **Crucially, the solution will extend to automatically setting or unsetting the appropriate membership roles within WordPress, likely via a custom plugin, directly linking payment reconciliation to the correct assignment of member benefits.** Foundational to this solution is a complete overhaul of the application's security, including strengthening authentication and implementing strict data privacy rules, such as hashing bank account numbers and never storing sensitive data like account balances.

The long-term vision is to create a **fully integrated membership management system** that transforms the process from a reactive administrative burden into a streamlined, automated, and trustworthy function. This will free up administrator time, prevent revenue loss, improve the member experience, and provide a solid, secure foundation for managing member data.

### Target Users

#### Primary User Segment: NADSA Administrators
* **Profile**: The small team or individual responsible for managing the NADSA membership program. They are likely volunteers or part-time staff who handle administrative and financial reconciliation for the charity.
* **Current Behaviors**: Their current workflow involves manually downloading reports from multiple sources (Lloyds Bank, Stripe) and painstakingly cross-referencing them against the GHL interface. This process is infrequent but time-consuming and stressful.
* **Needs & Pain Points**: They need a dramatically faster and more reliable method for reconciling payments. Their primary pain is the tedious, repetitive nature of the current task and the lack of confidence in the data's accuracy.
* **Goals**: To quickly and accurately verify membership payments, ensure the membership data in GHL and WordPress is always correct, and reduce the time spent on administrative tasks.

#### Secondary Stakeholder Group: NADSA Members
* **Profile**: The general membership base, which includes a significant portion of older, less tech-savvy individuals. Many prefer traditional payment methods like Standing Orders.
* **Behaviors**: Members pay their annual dues and expect their benefits (like ticket discounts in WordPress) to be applied automatically and correctly. They are not direct users of this new tool.
* **Needs & Pain Points**: They need the renewal process to remain simple and non-intrusive. A key consideration is that the system must not feel distrustful or place any new technical burden on them to prove their payment. A pain point would be their benefits not working correctly due to data errors.
* **Goals**: To support the charity, maintain their membership status with minimal effort, and seamlessly receive the benefits they are entitled to.

### Goals & Success Metrics

#### Business Objectives
* **Reduce Administrative Time**: Decrease the time spent on manual membership reconciliation by at least 90% within the first three months of launch.
* **Improve Data Accuracy**: Achieve and maintain over 99% accuracy for membership statuses in GHL and the corresponding user roles in WordPress.
* **Eliminate Revenue Leakage**: Eradicate revenue loss caused by lapsed members incorrectly receiving ticket discounts within the first reconciliation cycle post-launch.
* **Enhance Security**: Implement enhanced authentication and secure data handling protocols, ensuring no sensitive, unhashed financial data is ever stored on the system.

#### User Success Metrics (for NADSA Administrators)
* **High Confidence**: Administrators will have high confidence in the accuracy of the membership data, measured by a significant reduction in the need for manual spot-checks and corrections.
* **Increased Efficiency**: An administrator will be able to reconcile a full month's worth of payments from both Lloyds and Stripe in under 30 minutes.
* **Ease of Use**: A new administrator can be trained on the dashboard and use it effectively for reconciliation within a single 15-minute session.

#### Key Performance Indicators (KPIs)
* **Time to Reconcile**: The average time (in minutes) to process a monthly batch of payments.
* **Manual Intervention Rate**: The percentage of transactions per batch that the system cannot automatically match or suggest a match for, requiring manual investigation.
* **Data Discrepancy Rate**: The number of incorrect member statuses or WordPress roles identified after a reconciliation cycle.

### MVP Scope

#### Core Features (Must Have)
* **Security Overhaul**: A complete upgrade of the existing authentication system to a secure, robust standard.
* **Secure Data Handling**: Implementation of the required data privacy rules: hashing bank account numbers upon import and ensuring sensitive data like account balances are never stored.
* **Bank CSV Import**: A dashboard feature allowing an administrator to upload a transaction CSV file from Lloyds Bank.
* **Smart Matching UI**: A "smart suggestion" interface that displays payments from the CSV and proposes likely member matches from GHL based on name and amount.
* **Manual Confirmation Workflow**: The ability for an administrator to confirm a suggested match with a single click.
* **Stripe Report Import**: A dashboard feature allowing an administrator to upload a detailed transaction report from Stripe.
* **GHL Data Update**: Upon a confirmed match from either source, the system must automatically update the member's `Renewal Date` and other relevant status fields/tags in GHL.
* **WordPress Role Automation**: Integration with WordPress to automatically set or unset the appropriate member roles based on the updated GHL status.

#### Out of Scope for MVP
* **Direct API Integration**: Direct, real-time API connections to Lloyds Bank or Stripe; the MVP will rely on manual file uploads.
* **Automated Member Communications**: Automated emails to members for payment confirmations or renewal reminders.
* **Advanced Analytics**: A historical dashboard with charts and graphs of renewal rates, revenue trends, etc.
* **Complex Edge-Case Automation**: Fully automated handling of ambiguous situations like partial payments or unrecognized payer names; the MVP will flag these for the administrator to resolve manually.

#### MVP Success Criteria
The MVP will be considered a success when an administrator can successfully and accurately reconcile a full month's worth of payments from both Lloyds Bank and Stripe using the new dashboard. This includes the corresponding membership statuses and WordPress roles being updated automatically and accurately, with all foundational security requirements having been met.

### Post-MVP Vision

#### Phase 2 Features
* **Direct API Integration**: Connect directly to Lloyds Bank and Stripe APIs to fully automate the transaction import process, eliminating the need for manual CSV/report uploads.
* **Automated Member Communications**: Introduce automated emails for events like payment confirmations, renewal reminders, and notifications for lapsed memberships.
* **Advanced Administrative Tools**: Enhance the dashboard to allow for manual corrections, handle complex edge cases (e.g., partial payments), and provide a more detailed audit log.

#### Long-term Vision
In the long term, the dashboard could evolve into a complete membership management hub. This would include analytics on member retention, automated handling of complex payment scenarios, and proactive alerts for administrators, transforming the entire membership lifecycle from a reactive task to a proactive, data-driven function.

#### Expansion Opportunities
* The system could be expanded to manage other types of donations or event payments, creating a single source of truth for the charity's income.
* Deeper integration with WordPress could offer tiered benefits or personalized content based on membership level and tenure.

### Technical Considerations

#### Platform Requirements
* **Target Platforms**: This is a web application designed for modern desktop browsers (Chrome, Firefox, Safari, Edge).
* **Performance Requirements**: The new dashboard interface should be fast and responsive, with interactive elements responding in under 200ms.

#### Technology Preferences
* **Frontend**: Continue using the existing stack: **Next.js 15.1.0**, **React 18**, and **Tailwind CSS 3.4.1**.
* **Backend**: Continue using **Next.js API Routes** with **Node.js 18+** and **NextAuth 4.24.11** for authentication.
* **Database**: The existing **PostgreSQL** database with the **Prisma 6.9.0** ORM will be used.
* **Hosting/Infrastructure**: The application will continue to be deployed on **Vercel**.

#### Architecture Considerations
* **Repository Structure**: The project will remain a **single repository** with a monorepo-style structure.
* **Integration Requirements**: A new integration with the **WordPress REST API** will be required to manage user roles. The existing integration with the **GoHighLevel (GHL) API** must be maintained and utilized.
* **Security/Compliance**: The project must adhere to the strict security requirements defined earlier: a complete **authentication system overhaul**, immediate **hashing of bank account numbers**, and ensuring sensitive data like account balances are **never stored**.

### Constraints & Assumptions

#### Constraints
* **Budget**: There is no financial budget for this project.
* **Resources**: Development will be performed by the project owner with the assistance of an AI development partner. The primary resource constraint is the owner's available time.
* **Technical**: The solution must be built upon the existing Next.js/Prisma/GHL technical stack and must successfully integrate with the external WordPress system.

#### Key Assumptions
* **Data Availability**: We assume that transaction reports in CSV or a similar format can be regularly and reliably exported from both Lloyds Bank and Stripe.
* **Data Quality**: We assume the data within the exported reports (e.g., payer names, transaction details) is of sufficient quality to allow for a high success rate of the 'smart matching' feature.
* **API Access**: We assume that we will have the necessary administrative access and permissions to both the GoHighLevel API and the WordPress site to read and write the required data (update contact fields, manage user roles).

### Risks & Open Questions

#### Key Risks
* **Data Quality Risk**: The payer names in the bank and Stripe reports may be too inconsistent or ambiguous for the 'smart matching' to be highly effective, potentially requiring more manual intervention than planned.
* **WordPress Integration Risk**: Integrating with the WordPress site (**v6.8.2**) may be complex due to security policies enforced by the **Wordfence plugin** and **WPX hosting** environment.
* **Existing Security Risk**: The current authentication system's lack of **brute-force protection (lockout mechanisms)** and **security notifications** presents an immediate vulnerability that must be addressed before adding new functionality.

#### Open Questions
* What are the specific API rate limits for the GoHighLevel API? (Note: The local PostgreSQL database serves as a cache to mitigate this risk by reducing API calls).
* What are the best practices for API integration with a WordPress site protected by the Wordfence plugin?

#### Areas Needing Further Research
* A secure method for connecting the Next.js application to the Wordfence-protected WordPress REST API to manage user roles.
* The feasibility and security implications of creating a lightweight, custom WordPress plugin versus using the standard REST API for this specific hosting environment (WPX).

### Appendices

#### A. Research Summary
No formal market or user research was conducted for the creation of this brief.

#### B. Stakeholder Input
All requirements, context, and constraints for this brief were provided by the project owner during the brainstorming and drafting sessions.

#### C. References
* NADSA GHL Client Manager - Brownfield Architecture Document.md
