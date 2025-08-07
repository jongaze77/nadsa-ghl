# Technical Constraints and Integration Requirements

## Existing Technology Stack

The enhancement must be developed using the project's existing technology stack to ensure compatibility and maintainability. This includes:
* **Languages & Frameworks**: TypeScript 5.9.2, Next.js 14.2.31, React 19.1.1, NextAuth 4.24.11
* **Database**: PostgreSQL with Prisma 6.13.0
* **Styling**: Tailwind CSS v4.1.11
* **External Dependencies**: The solution must integrate with the GoHighLevel API and the new WordPress REST API.

## Integration Approach

* **Database Integration**: Any new data models must be created via Prisma migrations and be backward-compatible with the existing schema.
* **API Integration**: New backend logic will be exposed via new Next.js API routes (e.g., `/api/reconciliation/`). A new service for the WordPress integration will be created in the `src/lib/` directory.
* **Frontend Integration**: The new dashboard will be created as a new protected route within the Next.js App Router. It will consume the new internal API routes.
* **Testing Integration Strategy**: Given the current lack of automated tests, all new backend and frontend components created for this enhancement **must** be accompanied by unit and/or integration tests. The goal is to establish a testing foundation for future development and ensure the new features are reliable.

## Code Organization and Standards

* **File Structure**: New code must follow the existing project structure. For example, dashboard components should reside in `src/app/admin/reconciliation/` and `src/components/reconciliation/`.
* **Coding Standards**: All new TypeScript code must be written in strict mode and pass all ESLint rules. A key goal of this project is to improve code quality, not perpetuate existing technical debt.

## Deployment and Operations

* **Deployment**: The enhancement will be deployed via the existing Vercel integration pipeline.
* **Configuration**: All new secrets (e.g., WordPress API keys, new authentication secrets) must be managed via environment variables, consistent with the current setup.

## Risk Assessment and Mitigation

* **Technical Risk**: The existing build process, which ignores TypeScript/ESLint errors, must be addressed as part of the security overhaul before the new dashboard is deployed.
* **Integration Risk**: The new WordPress integration is a primary risk due to the Wordfence plugin and WPX hosting environment. This will require dedicated research and testing in a staging environment.
* **Lack of Existing Tests**: The absence of an existing automated test suite means regression testing for the current application functionality will be entirely manual and potentially unreliable, increasing the risk of introducing bugs into the old codebase.

---