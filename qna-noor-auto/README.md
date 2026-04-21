# QNA / Noor Auto Repair — Shop Software

Local-first shop management software for an auto repair shop. Phase 1 MVP:

- **Customers** — contact info, address, notes
- **Vehicles** — attached to a customer, with free NHTSA VIN decode (year, make, model, engine, drivetrain, etc.)
- **Repair Orders** — the classic "3 Cs" (complaint, cause, correction), labor lines, parts lines, mileage in/out, status workflow (estimate → in progress → completed → invoiced → paid)
- **Invoice PDFs** — one-click PDF generation per RO (via `pdf-lib`)
- **CSV importer** — flexible column-mapping importer to migrate customers + vehicles from Identifix Shop Management (or any other SMS)
- **Dashboard** — totals, revenue this month, recent ROs
- **Settings** — shop name, address, default labor rate, default tax rate

## Stack

- Next.js 16 (App Router, TypeScript, Turbopack)
- React 19
- Prisma 6 + SQLite (single file, zero external services)
- Tailwind CSS 4
- `pdf-lib` for invoices
- `papaparse` for CSV import
- NHTSA vPIC (free VIN decoder, no API key)

## Run it locally

```bash
# 1. Install deps (one time)
pnpm install

# 2. Create DB + run migrations (one time)
pnpm db:migrate

# 3. Load demo data (one time, optional)
pnpm db:seed

# 4. Start the dev server
pnpm dev
```

Then open <http://localhost:3000>.

### Useful scripts

| Script              | What it does                                                     |
| ------------------- | ---------------------------------------------------------------- |
| `pnpm dev`          | Start the dev server                                             |
| `pnpm build`        | Production build                                                 |
| `pnpm start`        | Run the production build                                         |
| `pnpm typecheck`    | `tsc --noEmit`                                                   |
| `pnpm lint`         | ESLint                                                           |
| `pnpm db:migrate`   | Apply Prisma migrations                                          |
| `pnpm db:seed`      | Insert demo customers / vehicles / ROs (skips if data exists)    |
| `pnpm db:reset`     | **Destructive.** Wipe DB, re-run migrations, re-seed.            |

### Database

- SQLite file at `prisma/dev.db`.
- Connection string is configured in `.env` as `DATABASE_URL="file:./dev.db"`.
- The DB is just a file — backing up = copying the file. Move it anywhere.

## Migrating from Identifix Shop Management

1. In Identifix Shop Management (or whatever SMS has your customer/job data), export customers + vehicles to CSV. Typical paths:
   - **Reports → Customer List → Export to CSV**
   - **Tools → Data Export / Backup → CSV**
   - **Setup → Data Tools → Export**
   - If you can't find an export option, call Identifix support and ask for your data as CSV — they are required to give it to you.
2. In this app, go to **Import** in the left nav.
3. Upload the CSV. The app will try to auto-match your columns (e.g. "Cust First Name" → First name).
4. Review / adjust the column mapping. Fields you don't want to import can be set to "— skip —".
5. (Optional) Leave "Auto-fill missing year/make/model from VIN" checked — free, uses NHTSA.
6. Click **Import**. You'll get a summary (X customers, Y vehicles created, any errors).

The importer de-dupes on email (if present) or on `firstName + lastName + phone`, so running it twice on the same file will not create duplicates.

## What's intentionally *not* here yet

Phase 1 is scoped tight so you can use it today. These are coming later:

- **Phase 2** — customer-facing portal (view history, request appointment)
- **Phase 3** — your own "hotline archive" knowledge base keyed to year/make/model/engine; OBD-II DTC lookup
- **Phase 4** — shop management (staff, inventory, appointments, time clock)
- **Phase 5** — paid OEM integrations (ALLDATA, Mitchell, Motor labor times); mobile app

## Notes

- The shop name, address, phone, email, default labor rate, and default tax rate live in **Settings**. Update them before generating invoices for real customers.
- RO numbers auto-increment starting from 1001 (configurable in `src/lib/shop.ts`).
- VIN decoding is free (NHTSA). It returns year/make/model/engine/drivetrain/body style — which is everything a bill of sale needs. Paid APIs (DataOne, Carfax, VinAudit) give you more (trim detail, options packages) if/when you need them.
