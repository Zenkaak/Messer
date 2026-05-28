# GSM World Store

A full-stack phone unlock and FRP bypass service storefront. Customers browse services (iPhone unlock, Android unlock, Samsung unlock, FRP bypass), add to cart with IMEI/device identifiers, and place orders. Admins manage orders, message customers, and update statuses via a built-in dashboard.

## Run & Operate

- `pnpm --filter @workspace/gsm-africa run dev` — run the frontend (port 3000)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Neon Postgres connection string (set as secret)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (artifacts/gsm-africa, port 3000)
- API: Express 5 (artifacts/api-server, port 8080)
- DB: PostgreSQL (Neon) + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/gsm-africa/` — React+Vite frontend (store + admin UI)
- `artifacts/api-server/` — Express 5 API server
- `lib/db/src/schema/index.ts` — DB schema (source of truth)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contracts)
- `artifacts/api-server/src/routes/` — all route handlers
- `artifacts/api-server/src/lib/email.ts` — email templates (OTP, order updates, etc.)
- `artifacts/api-server/src/lib/admin-settings.ts` — admin settings helpers

## Architecture decisions

- Admin auth uses plain `x-admin-password` header (no JWT) — password stored in `admin_settings` DB table
- OTPs stored in `admin_settings` table (keyed as `otp:<email>`) so they survive server restarts
- Cart is in-memory per session (JWT-scoped); not persisted to DB
- All email is fire-and-forget; SMTP config read from DB (configurable in admin settings)
- Frontend proxies `/api` requests to the API server via Vite dev proxy (port 8080)

## Product

- **Store**: Browse unlock/FRP services by category, add to cart with IMEI
- **Checkout**: M-Pesa, USDT, wallet, NowPayments, CoinGate payment methods
- **Orders**: Users view order history, upload files, message support
- **Admin dashboard**: Manage orders, products, users, categories, settings; direct message customers
- **Service pages**: Dedicated info pages for FRP, iPhone unlock, Android unlock, Direct unlock
- **WhatsApp support**: Floating button throughout the app (+254756816951)

## User preferences

- All database changes go to the Neon production database
- Admin password: `098098Pp%`
- Support WhatsApp: `+254756816951`
- Test account: `dasnetventures@gmail.com` (password: `GSMWorld2024!`)

## Gotchas

- API server dev script runs `build` then `start` — must rebuild on every change before the new code is live
- The vite dev proxy points to `http://localhost:8080` (API server port)
- Admin password is stored in the `admin_settings` table under key `admin_password`
- Cart blocks checkout if required `deviceIdentifier` (IMEI/username) fields are empty
- `pnpm --filter @workspace/db run push` uses the `DATABASE_URL` env to push schema to Neon

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
