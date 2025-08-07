# Repository Tree
```text
|-- .git/
|-- .github/
|   +-- workflows/
|   |   |-- ci.yml
|   |   |-- migrate.yml
|   |   +-- node.js.yml
|-- .next/
|-- .vercel/
|   |-- project.json
|   +-- README.txt
|-- docs/
|-- node_modules/
|-- prisma/
|   |-- migrations/
|   |   |-- 20250607231349_init/
|   |   |   +-- migration.sql
|   |   +-- migration_lock.toml
|   |-- schema.prisma
|   +-- seed.js
|-- public/
|   |-- file.svg
|   |-- globe.svg
|   |-- next.svg
|   |-- vercel.svg
|   +-- window.svg
|-- src/
|   |-- app/
|   |   |-- all-contacts/
|   |   |   |-- client.tsx
|   |   |   +-- page.tsx
|   |   |-- api/
|   |   |   |-- auth/
|   |   |   |   +-- [...nextauth]/
|   |   |   |-- contact/
|   |   |   |   +-- [id]/
|   |   |   |-- contacts/
|   |   |   |   |-- [id]/
|   |   |   |   |-- new/
|   |   |   |   +-- route.ts
|   |   |   |-- custom-fields/
|   |   |   |   +-- route.ts
|   |   |   |-- notes/
|   |   |   |   +-- route.ts
|   |   |   |-- users/
|   |   |   |   +-- route.ts
|   |   |   +-- webhooks/
|   |   |   |   +-- ghl-contact-created/
|   |   |-- contact/
|   |   |   +-- [id]/
|   |   |   |   +-- page.tsx
|   |   |-- contacts/
|   |   |   |-- [id]/
|   |   |   |   |-- client.tsx
|   |   |   |   |-- EditContactClient.tsx
|   |   |   |   +-- page.tsx
|   |   |   +-- new/
|   |   |   |   +-- page.tsx
|   |   |-- login/
|   |   |   +-- page.tsx
|   |   |-- quick-search/
|   |   |   +-- page.tsx
|   |   |-- users/
|   |   |   +-- page.tsx
|   |   |-- favicon.ico
|   |   |-- globals.css
|   |   |-- layout.tsx
|   |   +-- page.tsx
|   |-- components/
|   |   |-- ContactEditForm.tsx
|   |   |-- FullContactEditForm.tsx
|   |   |-- MembershipTypeFilterPanel.tsx
|   |   |-- Navigation.tsx
|   |   +-- Providers.tsx
|   |-- lib/
|   |   |-- auth.ts
|   |   |-- contact-filter.ts
|   |   |-- ghl-api.ts
|   |   |-- prisma.ts
|   |   +-- useLocalStorageMembershipTypeFilter.ts
|   |-- scripts/
|   |   |-- check-db.ts
|   |   +-- sync-contacts.ts
|   |-- types/
|   |   +-- next-auth.d.ts
|   +-- middleware.ts
|-- types/
|   +-- globals.d.ts
|-- .env
|-- .env.local
|-- .eslintignore
|-- .eslintrc.json
|-- .gitignore
|-- .npmrc
|-- check.js
|-- hash-password.js
|-- next-env.d.ts
|-- next.config.js
|-- package-lock.json
|-- package.json
|-- postcss.config.js
|-- README.md
|-- tailwind.config.js
|-- tsconfig.json
|-- tsconfig.tsbuildinfo
+-- vercel.json
```
