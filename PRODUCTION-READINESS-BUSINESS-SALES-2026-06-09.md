# Archie Management Business & Sales Production Readiness

Date: 9 June 2026

Target: `https://archie.nexoratech.co`

Status: Ready for release preparation. Production deployment has not been executed.

## Release Scope

- Business & Sales enhancement integration from Archie Management-PCI.
- Lead-to-Client flow and button parity with Archie Management-PCI.
- Quotation, Contract, Project, Invoice, Payment, Item, and Expense enhancements.
- Additive database schema changes through GORM AutoMigrate.
- Nginx API routing uses the unique `archie-backend` container hostname.

## Local Acceptance

- Go tests passed.
- Frontend TypeScript and production build passed.
- Backend and frontend Docker images built successfully.
- Local frontend responded on port `3000`.
- Protected API routing reached the Archie Management backend.
- Lead-to-Client flow was manually tested and accepted by the user.

## Git Scope

Current branch: `main`

Current remote: `origin` -> `Archie-Tech-Team/Archie Management`

The local branch already contains one commit not yet on `origin/main`:

```text
227d66a feat: Leads auto-clear converted_client_id on status change
```

The Business & Sales working-tree changes still need a dedicated release commit.

Do not include these local files in the release commit:

```text
catatan NEX-ONE WEB.docx
docker-compose.override.yml
.env
```

The `.env` file is ignored. The Word document and compose override are currently untracked and must remain unstaged.

## Database Changes

The backend runs GORM AutoMigrate before starting the HTTP server. The release adds these columns without deleting existing records:

```text
contracts.file_name
expenses.item_id
invoices.parent_invoice_id
invoices.subtotal_amount
leads.converted_client_id
projects.contract_id
quotations.file_name
quotations.file_url
```

Production database backup is mandatory before restarting the backend because migration occurs automatically at startup.

## Pre-Deploy Checklist

- Confirm production `.env` is present and not modified by the release.
- Confirm `ENV=production`, `APP_URL=https://archie.nexoratech.co`, and `VITE_API_URL=/api/v1`.
- Confirm JWT, SMTP, WhatsApp, and PostgreSQL secrets are populated.
- Confirm the external Docker network `web` exists.
- Confirm free disk space for image build and database backup.
- Record the currently deployed Git commit and Docker image IDs.
- Run `go test ./...` and `npm run build` from the final release commit.
- Review `git diff --check` and verify only intended files are staged.

## Backup

Run on the production server before deployment:

```bash
docker exec archie-postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > archie-pre-business-sales-2026-06-09.dump
docker inspect archie-backend --format '{{.Image}}'
docker inspect archie-frontend --format '{{.Image}}'
```

Store the dump outside the application directory or copy it to protected backup storage.

## Deployment Sequence

```bash
git fetch origin
git pull --ff-only origin main
docker compose build backend frontend
docker compose up -d backend frontend
docker compose ps
docker compose logs --tail=200 backend frontend
```

Do not use `docker compose down -v`; it would remove persistent database and upload volumes.

## Production Smoke Test

- Open `https://archie.nexoratech.co` and log in with an authorized account.
- Confirm dashboard and navigation load without API errors.
- Verify Lead list and Kanban views.
- Move or edit a test Lead to Won and confirm the `-> Client` button appears.
- Convert the test Lead and confirm the button changes to the converted Client indicator.
- Confirm the generated Client detail opens and contains the expected name, email, and phone.
- Verify Quotation list/detail and conversion actions.
- Verify Contract list/detail, project linkage, and document access.
- Verify Project creation with optional Contract selection.
- Verify Invoice list/detail, totals, terms, payment history, print, and CSV actions.
- Verify Payment and Expense list/create flows.
- Confirm existing Cluster, PIC, Milestone, Deliverable, Asset, WhatsApp, and permission flows still load.

## Technical Verification

```bash
curl -I https://archie.nexoratech.co
docker compose ps
docker compose logs --tail=200 backend
```

Expected results:

- Public site returns HTTP 200 or the configured redirect to HTTPS.
- PostgreSQL is healthy.
- Backend and frontend containers remain running.
- Backend logs contain no migration, database, panic, or routing errors.

## Rollback

If the release fails before any business data is entered:

```bash
git checkout <previous-production-commit>
docker compose build backend frontend
docker compose up -d backend frontend
```

Because the migration is additive, application rollback should normally leave the new nullable columns in place. Restore the database dump only if migration or data validation caused actual data corruption. A restore must be treated as a separate, explicitly approved operation because it overwrites production data.

## Release Gate

Deployment may proceed only after:

- The Business & Sales changes are committed intentionally.
- The release commit is pushed to `origin/main`.
- A production database backup is confirmed readable.
- Production environment values and Docker network are verified.
- A rollback commit reference is recorded.
