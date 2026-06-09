# NEXONE Business & Sales Enhancements

Date: 9 June 2026

## Objective

Bring the Business & Sales capabilities from NEXONE-PCI into NEXONE while retaining newer NEXONE features such as Cluster, PIC, Milestones, Deliverables, WhatsApp, messaging/presence, granular permissions, and the current Asset Management implementation.

The integration was performed selectively. Whole backend files were not replaced because the two projects have diverged.

## Business Flow

The enhanced workflow is:

```text
Lead -> Client -> Quotation -> Contract -> Project -> Invoice -> Payment
```

Internal purchasing remains:

```text
Items -> Expenses -> Reports
```

## Leads

- The Lead-to-Client conversion flow and buttons now match NEXONE-PCI exactly.
- The `-> Client` action is displayed only for a Won lead that has not been converted.
- After conversion, the action is replaced by the `Client` converted indicator.
- Conversion creates a Client from the lead name, email, and phone, then sets the lead status to `won` and stores `converted_client_id`.
- Converted leads are retained instead of being deleted.
- The generated client is stored in `converted_client_id`.
- Added rollback from converted lead to `new`.
- Rollback clears `converted_client_id` and allows conversion again.
- Changing a converted lead away from `won` clears its client link.
- Added API endpoint: `POST /api/v1/leads/:id/rollback`.
- List and Kanban views display the conversion action before conversion and the Client indicator afterward, matching NEXONE-PCI.

## Quotations

- Quotation can be linked to a lead with an optional direct client relation.
- Client is resolved from `lead.converted_client_id` during conversion.
- Conversion is rejected when the lead has not been converted to a client.
- Added document upload metadata using `file_url` and `file_name`.
- Added Indonesian amount-in-words generation (`terbilangIDR`).
- Improved item loading and item-management workflow.
- Added conversion modal for creating invoices with custom number, dates, totals, and notes.
- Finance policy keeps converted invoices unpaid until payment is manually verified.
- Existing quotation print fixes and NEXONE branding behavior were retained where newer.

## Contracts

- Expanded contract list with pagination, linked project count, progress, and financial information.
- Added detailed contract page with:
  - Client information.
  - Contract value and validity.
  - Linked projects and average progress.
  - Related expenses.
  - Related invoices and payments.
  - Total invoiced, total paid, and outstanding amount.
  - Paid and outstanding percentages.
  - Visual outstanding indicators.
- Added contract document upload, download, and removal.
- Added persisted `file_name` metadata.
- Contract detail progress bars now animate and clamp values between 0-100%.
- Linked project progress is recalculated from current task completion when projects are loaded, preventing stale progress values.
- Invoice filtering prioritizes projects linked to the contract.
- Client-level fallback is used for invoices without a project.

## Projects

- Added optional `contract_id` relation to projects.
- Project API supports `contract_id` and `client_id` filters.
- Project responses preload the linked contract.
- Project form can select a contract.
- Selecting a contract auto-fills:
  - Client.
  - Project title.
  - Price and currency.
  - Start date and deadline.
- Existing NEXONE Cluster and PIC fields were retained.
- Existing Project Detail, Milestones, Deliverables, and task behavior were retained.

## Invoices

- Added stored `subtotal_amount` column mapping.
- Added optional parent invoice relation through `parent_invoice_id`.
- Added percentage/term-based invoice creation from project value.
- Added creation of remaining invoices for partially paid invoices.
- Remaining invoices are linked to their source invoice.
- Added parent invoice display and selection.
- Added CSV export and printable list view.
- Added payment recording from the invoice list.
- Added delete action from the invoice list.
- Invoice list preloads payments and parent invoice data.
- Recalculation preserves stored subtotal when an invoice has no line items.
- Existing NEXONE overdue detection and overpayment validation were retained.
- Payments remain manual; child invoices do not automatically create payments.

## Payments

- Added pagination and debounced search.
- Added CSV export.
- Added printable payment report.
- Added transaction numbering and clearer client/invoice information.
- Existing payment recalculation and delete behavior were retained.

## Items And Expenses

- Items remain master data for internal goods and services.
- Expenses can select an item and auto-fill:
  - Category.
  - Title.
  - Amount.
- Added optional `item_id` relation on expenses.
- Existing client, project, contract, tax, recurring expense, and reporting behavior was retained.

## Orders And Store

- Orders and Store remain implemented for legacy data and direct URL access.
- Both entries are hidden from primary navigation.
- The recommended primary flow is Quotation -> Contract -> Project.

## Navigation And UI Infrastructure

- Business & Sales navigation focuses on Leads, Clients, Quotations, Contracts, and Items.
- Finance continues to contain Invoices, Payments, and Expenses.
- Modal component now supports `xl` size for complex quotation forms.
- File service now supports authenticated blob downloads.
- Project service now supports project Kanban-column retrieval.
- Quotation service accepts optional invoice conversion payloads.

## Database Changes

All schema changes are additive and applied through GORM AutoMigrate.

Added or persisted columns:

```text
leads.converted_client_id
projects.contract_id
invoices.parent_invoice_id
invoices.subtotal_amount
quotations.file_url
quotations.file_name
contracts.file_name
expenses.item_id
```

No existing tables or business records were deleted or reset.

## Local Proxy Fix

The frontend Nginx API proxy now uses the unique container hostname:

```text
nexone-backend:8080
```

This prevents the generic Docker network alias `backend` from routing NEXONE requests to another project's backend.

## Files Updated

Backend:

- `Backend/internal/models/models.go`
- `Backend/internal/handlers/handlers.go`
- `Backend/internal/handlers/quotation.go`
- `Backend/internal/server/server.go`

Frontend infrastructure:

- `Frontend/nginx.conf`
- `Frontend/src/services/api.ts`
- `Frontend/src/utils/format.ts`
- `Frontend/src/components/common/index.tsx`
- `Frontend/src/config/navigation.ts`

Frontend modules:

- `Frontend/src/pages/Leads/LeadsPage.tsx`
- `Frontend/src/pages/Projects/ProjectsPage.tsx`
- `Frontend/src/pages/Expenses/ExpensesPage.tsx`
- `Frontend/src/pages/Sales/ContractDetailPage.tsx`
- `Frontend/src/pages/Sales/ContractsPage.tsx`
- `Frontend/src/pages/Sales/InvoicesPage.tsx`
- `Frontend/src/pages/Sales/ItemsPage.tsx`
- `Frontend/src/pages/Sales/OrdersPage.tsx`
- `Frontend/src/pages/Sales/PaymentsPage.tsx`
- `Frontend/src/pages/Sales/QuotationsPage.tsx`
- `Frontend/src/pages/Sales/StorePage.tsx`

## Verification

Completed checks:

- Frontend TypeScript and Vite production build passed.
- All Go tests passed.
- Docker backend and frontend images rebuilt successfully.
- PostgreSQL AutoMigrate added all required columns.
- Local login through `http://localhost:3000` returned HTTP 200.
- Authenticated smoke tests returned HTTP 200 for:
  - Leads.
  - Quotations.
  - Contracts.
  - Projects.
  - Invoices.
  - Payments.
  - Items.
  - Expenses.
- The Lead-to-Client flow was manually validated and accepted on local NEXONE on 9 June 2026.
- `Frontend/src/pages/Leads/LeadsPage.tsx` was verified identical to the NEXONE-PCI implementation.

## Known Technical Notes

- The frontend production bundle remains larger than 500 kB and Vite reports a chunk-size warning. This is not a build failure.
- The Lead-to-Client UI was manually tested by the user on localhost.
- No commit was created as part of this enhancement work.
