# Tech Stack Alignment

## Target Technology Stack

This enhancement will be built using the following target versions, which in some cases represent an upgrade from the versions currently in the project. The dependency upgrade process will be a managed part of the initial development stories.

| Category | Target Technology | Target Version | Usage in Enhancement |
| :--- | :--- | :--- | :--- |
| Framework | Next.js | **14.2.31** | New dashboard pages, API routes. |
| UI Library | React | **19.1.1** | Building all new UI components. |
| Database ORM | Prisma | **6.13.0** | Handling schema migration and data access. |
| Authentication | NextAuth | **4.24.11** | Will be reconfigured and enhanced. |
| Styling | Tailwind CSS | **v4.1.11** | Styling all new components. |
| Language | TypeScript | **5.9.2** | All new code will be written in TypeScript. |

## New Technology Additions

To meet the new requirements for testing and integration, the following libraries will be added to the project.

| Technology | Recommended Version | Purpose | Rationale |
| :--- | :--- | :--- | :--- |
| Jest & React Testing Library | Latest | Component and Unit Testing | To fulfill the new testing requirement in the PRD and establish a testing foundation. This is the industry standard for testing React applications. |
| Axios | Latest | HTTP Client | To provide a robust client for communicating with the external WordPress REST API, offering better error handling and interceptors than the basic `node-fetch`. |
