# DC Bakery — B2B Wholesale Site

## Project overview

B2B wholesale ordering platform for corporate clients (cafes, restaurants, hotels, stores).
Strictly B2B only. NO B2C features. Retail clients see a redirect to the app.

## Critical business flow

catalog → cart → checkout → order created (status: pending_manager_confirmation)
→ manager confirms in admin → payment link sent to client via WhatsApp
→ client pays → webhook updates status to paid
→ manager marks delivering/completed

## Tech stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Supabase (PostgreSQL + Auth)
- Green API for WhatsApp
- Telegram for manager notifications
- Deployed to Netlify or Render

## FORBIDDEN — never change without explicit human approval

- app/api/payments/** — payment webhook, payment flow
- app/api/orders/** — order creation and status changes
- app/api/admin/login/** — admin authentication
- app/api/whatsapp/webhook/** — WhatsApp bot logic
- supabase/migrations/** — never create or run migrations
- src/lib/supabase/admin.ts — database queries
- proxy.ts — admin middleware
- .env and .env.local — secrets, never read or modify

## SAFE zones for small UI changes

- app/catalog/** — product display pages
- app/cart/** — cart UI
- app/order-success/** — success page text and layout
- src/components/catalog/** — product/category cards
- src/components/layout/** — header, footer
- src/components/ui/** — reusable UI primitives
- app/globals.css — global styles
- public/** — static assets

## Safe zones with caution

- src/components/checkout/CheckoutForm.tsx — form UI only, not submit logic
- src/components/profile/ProfileClient.tsx — display only, not auth logic
- app/page.tsx — homepage content only

## Key files to understand before any change

- src/types/index.ts — all TypeScript types
- app/constants.ts — MIN_ORDER_AMOUNT, B2B_PAYMENT_METHODS
- src/lib/order-status.ts — order status labels and flow
- src/lib/catalog.ts — how products are fetched and merged

## Rules for AI tools

1. Never run npm run build autonomously on production
2. Never touch migration files — schema changes require human review
3. Never modify payment flow without explicit instruction
4. Always propose changes as a diff/patch, not apply directly to risky zones
5. Maximum 3 files per patch proposal
6. When unsure about a zone — ask, don't assume
7. The admin panel (/admin) requires Supabase auth — never mock or bypass
