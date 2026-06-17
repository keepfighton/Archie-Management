# NEXONE - Project Context for Claude

## Overview
Aplikasi bisnis all-in-one untuk CBQA (IT Audit & Advisory Indonesia) yang mencakup manajemen klien, sales, proyek internal, keuangan, dan komunikasi. Dibangun untuk kebutuhan tim IT Audit PUSINTEK.

**Versi saat ini: v1.0.5**

## Local Development

### Port (lokal)
| Service | Port |
|---------|------|
| Frontend (Vite dev) | http://localhost:3091 |
| Backend (Go) | http://localhost:8091 |

### Jalankan App
```bash
# Tab 1 - Backend (WAJIB dari direktori Backend/ agar .env terbaca)
cd Backend
PORT=8091 go run cmd/api/main.go

# Tab 2 - Frontend
cd Frontend
npm install   # pertama kali saja
npm run dev   # jalan di :3091, proxy /api → :8092
```

### Seed Database (pertama kali)
```bash
cd Backend
go run cmd/seed/main.go
```

### Login Default
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@cbqa.com | Admin123! |
| Member | fauzi@cbqa.com | Member123! |

### Cek Health Backend
```bash
curl http://localhost:8092/health
```

### Prasyarat Database (install sekali)
```bash
brew install go postgresql@15
brew services start postgresql@15
psql postgres -c "CREATE USER cbqa WITH PASSWORD 'cbqa123';"
psql postgres -c "CREATE DATABASE cbqa_db OWNER cbqa;"
```

## Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript 5
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS 3.4
- **Routing**: React Router v6
- **State Management**: Redux Toolkit + React Redux
- **HTTP Client**: Axios (centralized di `src/services/api.ts`)
- **UI Libraries**: Recharts, @hello-pangea/dnd, react-big-calendar, Lucide React, react-toastify, clsx
- **Server**: Nginx (production)
- **Containerization**: Docker

### Backend
- **Language**: Go 1.23
- **Framework**: Gin (HTTP router)
- **ORM**: GORM v2 + PostgreSQL 15
- **Auth**: JWT (golang-jwt/v5) + bcrypt + in-memory token blacklist
- **Email**: `net/smtp` stdlib — tidak ada dependency tambahan
- **Structure**: Clean Architecture (cmd / internal)
- **Layers**: handlers → middleware → models → database → config
- **Containerization**: Docker
- **Orchestration**: docker-compose

## Project Structure

```
root/
├── Frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Auth/              # LoginPage, ForgotPasswordPage, ResetPasswordPage
│   │   │   ├── Dashboard/         # DashboardPage
│   │   │   ├── Clients/           # ClientsPage, ClientDetailPage
│   │   │   ├── Sales/             # StorePage, ItemsPage, OrdersPage,
│   │   │   │                      # ContractsPage, ContractDetailPage, PaymentsPage,
│   │   │   │                      # InvoicesPage, InvoiceDetailPage
│   │   │   ├── Projects/          # ProjectsPage, ProjectDetailPage
│   │   │   ├── Tasks/             # TasksPage (List/Kanban/Gantt)
│   │   │   ├── Todo/              # TodoPage
│   │   │   ├── Messages/          # MessagesPage (stub - coming soon)
│   │   │   ├── Leads/             # LeadsPage (List/Kanban)
│   │   │   ├── Expenses/          # ExpensesPage
│   │   │   ├── Notes/             # NotesPage
│   │   │   ├── Events/            # EventsPage
│   │   │   ├── Files/             # FilesPage (upload + download berfungsi)
│   │   │   ├── Reports/           # ReportsPage (+ Export CSV/Excel)
│   │   │   ├── Team/              # TeamMembersPage, TimeCardsPage,
│   │   │   │                      # LeavePage, AnnouncementsPage, HelpPage
│   │   │   ├── InternalProjects/  # InternalProjectsPage, InternalProjectDetailPage,
│   │   │   │                      # TimesheetPage, InternalProjectReportPage
│   │   │   └── Settings/          # UsersPage, RolesPage, AuditLogPage
│   │   ├── components/
│   │   │   ├── layout/            # Layout.tsx
│   │   │   └── common/            # ProtectedRoute, ManageLabelsModal, TaskTimer,
│   │   │                          # ClockInModal, SubtaskList, TaskCollaboration, ...
│   │   ├── services/
│   │   │   └── api.ts             # Semua API calls terpusat di sini
│   │   ├── store/
│   │   │   ├── index.ts
│   │   │   └── slices/            # authSlice, uiSlice
│   │   ├── utils/
│   │   │   └── format.ts          # isValidEmail, toISODate, formatNumber, parseNumber, formatIDR
│   │   ├── contexts/              # LocaleContext
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.ts             # port 3091, proxy /api → :8092
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── nginx.conf
│   └── Dockerfile
├── Backend/
│   ├── cmd/
│   │   ├── api/main.go            # entry point API server
│   │   └── seed/main.go           # database seeder
│   └── internal/
│       ├── config/config.go       # env vars: PORT, DB, JWT, SMTP, WhatsApp, UploadDir, AppURL
│       ├── database/database.go
│       ├── middleware/auth.go     # AuthRequired, AdminRequired, CORS, token blacklist
│       ├── models/models.go       # semua model entitas
│       ├── handlers/
│       │   ├── auth.go            # Login, Register, Me, Logout, ForgotPassword, ResetPassword, ChangePassword
│       │   ├── handlers.go        # semua handler bisnis (client, sales, team, dll)
│       │   ├── internal_project.go         # Internal Projects + Time Tracking handler
│       │   ├── internal_project_report.go  # Laporan internal project
│       │   ├── asset.go           # Asset Management handler
│       │   ├── messages.go        # Messaging handler
│       │   ├── notifications.go   # Notifikasi handler
│       │   ├── quotation.go       # Quotation handler
│       │   └── whatsapp.go        # WhatsApp Cloud API webhook
│       └── server/server.go       # Route setup (~150+ endpoints)
├── docker-compose.yml
├── .gitignore
└── README.md
```

## Fitur Utama
- **Auth**: Login, Forgot Password (kirim email), Reset Password, Protected Routes, JWT Middleware, Logout invalidate token
- **Dashboard**: Stats real-time (tasks, projects, invoices, team, clock in/out)
- **Clients**: Manajemen klien & detail klien (10 tab: overview, contacts, projects, invoices, dll)
- **Leads**: Pipeline leads/prospek (List + Kanban drag-drop), konversi Lead → Client
- **Sales**: Store, Items, Orders, Contracts, Payments, Invoices (line items & payments, Edit Invoice), Export PDF
- **Projects**: Manajemen proyek & detail proyek (List + Gantt)
- **Tasks**: Manajemen tugas (List + Kanban + Gantt)
- **Internal Projects**: Proyek internal tim (Kanban board, tasks, members, time tracking per task, timesheet, laporan)
- **Time Tracking** *(di Internal Projects)*: Timer per task, log manual, edit/delete log, summary total + breakdown per anggota
- **Todo**: Per-user todo list
- **Events**: Kalender events
- **Files**: File manager — upload & download berfungsi, storage lokal persisten (Docker volume)
- **Expenses**: Pencatatan pengeluaran per-user
- **Notes**: Catatan per-user
- **Team**: Members, Time Cards (absensi clock in/out WFO/WFH/WFA + GPS), Leave Management, Announcements
- **Reports**: Invoice summary, Projects summary, Leads funnel, Expenses total, Export CSV (Excel)
- **Settings**: Manajemen users, Dynamic RBAC (App Roles + Permissions), Audit Trail

## Business Logic Penting

### Invoice Auto-Status
`recalcInvoice()` di `handlers.go` dipanggil setiap kali payment ditambah/dihapus atau item berubah.
- `paid >= total` → `fully_paid`
- `paid > 0` → `partially_paid`
- `paid == 0 && status != draft && due_date lewat` → `overdue`

### Lead → Client Conversion
`POST /api/v1/leads/:id/convert` — membuat Client baru dari data Lead, auto-set lead status ke `won`.

### Time Cards (Absensi Tim)
- Model `TimeCard`: UserID, InDate, InTime, OutDate, OutTime, Duration (hours), WorkMode (WFO/WFA/WFH), Latitude, Longitude, DistanceM, LocationAccuracy
- ClockIn: set InTime + InDate ke `time.Now()`
- ClockOut: hitung `duration = now - InTime` dalam jam

### Internal Projects — Time Tracking (per task)
- Model `InternalTimeLog`: TaskID, UserID, ClockIn, ClockOut, DurationSeconds
- Timer dijalankan via `TaskTimer` component di tab "Time Tracking" modal task
- **Tab Time Tracking menampilkan:**
  - Summary total jam + jumlah log entries
  - Breakdown per anggota (jika >1 user)
  - Start/Stop Timer (compact mode)
  - Form tambah log manual (tanggal + jam mulai/selesai)
  - Riwayat log dengan tombol Edit (✏️) dan Delete (🗑️) — muncul saat hover
- **Edit log**: modal inline dengan date + time picker, kirim `PUT /tasks/:id/time-logs/:logId`
- **Delete log**: ConfirmDialog sebelum hapus

### Dashboard Stats
`GET /api/v1/dashboard` mengembalikan 22+ field real-time: task breakdown, invoice per-status amounts, project counts, clocked_in_count, on_leave_today, dll.

### Audit Trail
`recordAudit()` helper di `handlers.go` — otomatis rekam Create/Update/Delete/Convert untuk: Client, Project, Task, Lead, Invoice, Contract.
- Model: `AuditLog` — immutable (tidak pakai soft delete)
- Endpoint: `GET /api/v1/audit-logs` (Admin only) — filter entity_type, action, from, to, user_id

### Project Auto-fill di Form Sales
Form Add/Edit di **Orders, Contracts, Invoices** auto-fill dari project: tanggal, amount, client_id, currency.
Hint biru muncul di bawah field yang di-auto-fill.

### Invoice PDF Export
`GET /api/v1/invoices/:id/pdf` — generate HTML invoice, browser auto-trigger `window.print()`.

### Reports Export CSV
`GET /api/v1/reports/export?type=X&year=Y` — CSV dengan UTF-8 BOM.
Tipe: `invoices`, `expenses`, `leads`, `projects`, `timecards`.

### File Storage (Local)
- Struktur: `{uploadDir}/YYYY/MM/timestamp_namafile`
- Docker volume `uploads_data` → `/app/uploads` (persisten antar redeploy)
- Upload: `POST /api/v1/files/upload` | Download: `GET /api/v1/files/:id/download`

### Forgot Password & Reset Password
- Token 32-byte hex, berlaku 1 jam, kirim email via `net/smtp`
- Jika `SMTP_HOST` kosong: tidak error, email tidak dikirim (aman untuk dev lokal)

### JWT Token Invalidation (Logout)
- Setiap JWT punya `JTI` (16-byte hex unik)
- Logout blacklist JTI ke `sync.Map` in-memory; cleanup otomatis tiap 15 menit

### Dynamic RBAC (App Roles & Permissions)
- System role: `admin` / `member` (backward compat)
- Dynamic role: `AppRole` + `RolePermission` (app_role_id, menu, can_read, can_edit)
- Admin: full access. Member tanpa AppRole: full access. Member dengan AppRole: dibatasi permission.
- `nil permissions = full access` — konvensi di frontend (`authSlice`) dan backend (`resolvePermissions`)
- Frontend: `canRead()` / `canEdit()` di `authSlice.ts`; sidebar filter via `canRead()`

### Sidebar Navigation (Layout.tsx)
Grouped navigation — `NavGroupDef[]` dengan grup:
Dashboard | Business & Sales (Clients, Leads, Orders, Contracts, Store, Items) | Operations (Projects, Tasks, To Do, Events) | Finance (Invoices, Payments, Expenses) | People (Team, Time Cards, Leave, Announcements) | Collaboration (Messages, Notes, Files) | Assets *(coming soon)* | Reports | System (User Accounts, Roles, Audit Trail) | Help

- Sidebar `fixed` di semua breakpoint; main content `ml-72`/`ml-0` dengan `transition-[margin]`
- Logo: inline CSS gradient text `nexora` + subtitle "Part of CBQA Global Group"

## API Endpoints — Internal Projects (Time Tracking)

| Method | Path | Handler | Keterangan |
|--------|------|---------|-----------|
| POST | `/api/v1/internal-projects/tasks/:id/clock-in` | `ClockIn` | Start timer |
| POST | `/api/v1/internal-projects/tasks/:id/clock-out` | `ClockOut` | Stop timer |
| GET | `/api/v1/internal-projects/tasks/:id/time-logs` | `GetTimeLogs` | List logs + active log |
| POST | `/api/v1/internal-projects/tasks/:id/time-logs` | `CreateManualTimeLog` | Tambah log manual |
| PUT | `/api/v1/internal-projects/tasks/:id/time-logs/:logId` | `UpdateTimeLog` | Edit clock_in/clock_out |
| DELETE | `/api/v1/internal-projects/tasks/:id/time-logs/:logId` | `DeleteTimeLog` | Hapus log |
| GET | `/api/v1/internal-projects/my-time-logs` | `GetMyTimeLogs` | Log milik user saat ini |
| GET | `/api/v1/internal-projects/:id/time-logs` | `GetProjectTimeLogs` | Semua log di project |
| GET | `/api/v1/internal-projects/time-summary` | `GetTimeSummary` | Today + week seconds |
| GET | `/api/v1/internal-projects/my-active-log` | `GetActiveLog` | Cek apakah ada timer aktif |

## API Services di Frontend (`src/services/api.ts`)
Setiap modul punya service object:
- `authService`, `dashboardService`, `clientService`, `projectService`, `taskService`
- `leadService`, `invoiceService`, `paymentService`, `contractService`, `itemService`
- `orderService`, `eventService`, `noteService`, `expenseService`, `fileService`
- `todoService`, `teamService`, `labelService`
- `reportService` — termasuk `exportCSV(type, year)`
- `auditService`, `invoicePDFService`, `roleService`
- `internalProjectService` — list, get, CRUD tasks, members, time tracking (clockIn, clockOut, getTimeLogs, createManualTimeLog, **updateTimeLog**, deleteTimeLog, getTimeSummary, getMyTimeLogs, getProjectTimeLogs, getActiveLog), subtasks, comments, attachments, reference links, activities

## Coding Conventions

### Frontend (React/TypeScript)
- Functional components dengan hooks
- Ekstensi `.tsx`, penamaan **PascalCase**
- Semua API calls via service object di `src/services/api.ts`
- Shared components di `src/components/common/`
- Jangan gunakan `any` di TypeScript
- Tailwind CSS untuk styling, hindari inline style

### Backend (Golang)
- Clean Architecture: cmd → internal → handlers → models
- Error handling eksplisit
- Config dari environment variables via `internal/config`
- `godotenv.Load(".env.local", ".env")` — path relatif, **wajib jalankan dari direktori `Backend/`**
- Semua model menggunakan `gorm.DeletedAt` (soft delete) — **kecuali `AuditLog`** (immutable)
- Tanggal menggunakan tipe `FlexTime` (wrapper `time.Time` yang menerima RFC3339 dan `YYYY-MM-DD`)
- Email dikirim secara goroutine (non-blocking)

## Hal yang JANGAN Dilakukan
- Jangan tambah dependency baru tanpa diskusi
- Jangan gunakan `any` di TypeScript
- Jangan bypass middleware auth untuk route yang butuh autentikasi
- Jangan hardcode config/credentials — gunakan `.env`
- Jangan campur business logic dengan database logic
- Jangan commit `Frontend/dist/`, `node_modules/`, `.env`, `Backend/api.exe`
- Jangan hapus atau soft-delete record `AuditLog` — log harus immutable
- Jangan hapus file fisik dari disk tanpa menghapus record DB-nya (dan sebaliknya)
- Jangan jalankan backend dari direktori root — `godotenv` baca `.env` secara relatif dari CWD

## Environment

File `.env` ada di root repo (docker-compose) dan `Backend/.env` (run manual). Jangan commit `.env`.

```env
# App
ENV=development
PORT=8092            # lokal; production pakai 8080
APP_URL=http://localhost:3091
UPLOAD_DIR=./uploads

# Database
DB_HOST=localhost    # docker: gunakan nama service 'postgres'
DB_PORT=5432
DB_USER=cbqa
DB_PASSWORD=cbqa123
DB_NAME=cbqa_db

# Auth
JWT_SECRET=nexone-local-dev-secret-2026
JWT_EXP_HOURS=24

# SMTP (kosongkan untuk dev — tidak error)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@cbqa.com

# WhatsApp (opsional)
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_APP_SECRET=
WHATSAPP_API_VERSION=v20.0
WHATSAPP_OWNER_NUMBERS=
```

Version app ada di dua tempat (update keduanya saat bump versi):
- `Backend/internal/server/server.go` — health endpoint `{"version":"x.x.x"}`
- `Frontend/src/components/layout/Layout.tsx` — teks versi di sidebar footer

## Docker (Full Stack)
```bash
docker-compose up --build   # build & jalankan semua
docker-compose down
```
Volume: `postgres_data` (DB), `uploads_data` (file upload → `/app/uploads`)

## GitHub
- Remote NEXONE: https://github.com/Nexora-Tech-Team/NEXONE (branch: Dev_Har, main)
- Struktur root: `Backend/`, `Frontend/`, `docker-compose.yml`

## Changelog

### v1.0.5 (2026-06-15)
**Time Tracking Enhancement (Internal Projects):**
- Tab Time Tracking di modal task di-redesign sepenuhnya
- Summary bar: total jam tertracking + jumlah log entries di task
- Breakdown per anggota: tampil otomatis jika >1 user punya log di task yang sama
- Tambah Log Manual: form inline (tanggal + jam mulai/selesai) tanpa perlu timer
- Edit Log: modal edit clock_in/clock_out per log (ikon ✏️ saat hover)
- Delete Log: tombol hapus dengan ConfirmDialog (ikon 🗑️ saat hover)
- Backend: tambah endpoint `PUT /internal-projects/tasks/:id/time-logs/:logId` (`UpdateTimeLog` handler)
- Frontend service: tambah `internalProjectService.updateTimeLog()`

### v1.0.4
- Internal Projects module: Kanban board, task management, members, timesheet, laporan

### v1.0.3 (2026-04-27)
**UI Overhaul:**
- Sidebar grouped navigation — 10 grup (Business & Sales, Operations, Finance, People, Collaboration, Assets, Reports, System, Help)
- Sidebar auto-expand grup aktif; `fixed` di semua breakpoint
- Login page revamp — desain dua-panel

### v1.0.2 (2026-04-26)
- Audit Trail, Invoice PDF Export, Reports Export CSV
- Dynamic RBAC (App Roles + Permissions)
- File Storage fix, Forgot Password via SMTP, JWT Logout blacklist
- Clock In/Out fix (Redux state sync)

### v1.0.1
- Initial production release

### v1.0.0
- Init project
