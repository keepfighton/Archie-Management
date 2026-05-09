# CBQA IT Portfolio Assessment Tool - Project Context for Claude

## Overview
Aplikasi bisnis all-in-one untuk CBQA (IT Audit & Advisory Indonesia) yang mencakup manajemen klien, sales, proyek, keuangan, dan komunikasi. Dibangun untuk kebutuhan tim IT Audit PUSINTEK.

**Versi saat ini: v1.0.4**

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
│   │   │   ├── Auth/         # LoginPage, ForgotPasswordPage, ResetPasswordPage
│   │   │   ├── Dashboard/    # DashboardPage
│   │   │   ├── Clients/      # ClientsPage, ClientDetailPage
│   │   │   ├── Sales/        # StorePage, ItemsPage, OrdersPage,
│   │   │   │                 # ContractsPage, ContractDetailPage, PaymentsPage,
│   │   │   │                 # InvoicesPage, InvoiceDetailPage
│   │   │   ├── Projects/     # ProjectsPage, ProjectDetailPage
│   │   │   ├── Tasks/        # TasksPage (List/Kanban/Gantt)
│   │   │   ├── Todo/         # TodoPage
│   │   │   ├── Messages/     # MessagesPage (stub - coming soon)
│   │   │   ├── Leads/        # LeadsPage (List/Kanban)
│   │   │   ├── Expenses/     # ExpensesPage
│   │   │   ├── Notes/        # NotesPage
│   │   │   ├── Events/       # EventsPage
│   │   │   ├── Files/        # FilesPage (upload + download berfungsi)
│   │   │   ├── Reports/      # ReportsPage (+ Export CSV/Excel)
│   │   │   ├── Team/         # TeamMembersPage, TimeCardsPage,
│   │   │   │                 # LeavePage, AnnouncementsPage, HelpPage
│   │   │   └── Settings/     # UsersPage, RolesPage, AuditLogPage
│   │   ├── components/
│   │   │   ├── layout/       # Layout.tsx
│   │   │   └── common/       # ProtectedRoute, ManageLabelsModal, index
│   │   ├── services/
│   │   │   └── api.ts        # Semua API calls terpusat di sini
│   │   ├── store/
│   │   │   ├── index.ts
│   │   │   └── slices/       # authSlice, uiSlice
│   │   ├── utils/
│   │   │   └── format.ts     # isValidEmail, toISODate, formatNumber, parseNumber, formatIDR
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── nginx.conf
│   └── Dockerfile
├── Backend/
│   ├── cmd/
│   │   ├── api/main.go        # entry point API server
│   │   └── seed/main.go       # database seeder
│   └── internal/
│       ├── config/config.go   # termasuk SMTP + UploadDir + AppURL
│       ├── database/database.go
│       ├── middleware/auth.go  # AuthRequired, AdminRequired, CORS, token blacklist
│       ├── models/models.go    # 24 entitas (+ AppRole, + RolePermission, + AuditLog)
│       ├── handlers/
│       │   ├── auth.go         # Login, Register, Me, Logout, ForgotPassword, ResetPassword, ChangePassword
│       │   └── handlers.go     # Semua handler bisnis di sini
│       └── server/server.go    # Route setup (~120 endpoints)
├── docker-compose.yml          # termasuk volume uploads_data + env SMTP
├── .gitignore
└── README.md
```

## Fitur Utama
- **Auth**: Login, **Forgot Password (kirim email)**, **Reset Password**, Protected Routes, JWT Middleware, **Logout invalidate token**
- **Dashboard**: Stats real-time (tasks, projects, invoices, team, clock in/out)
- **Clients**: Manajemen klien & detail klien (10 tab: overview, contacts, projects, invoices, dll)
- **Leads**: Pipeline leads/prospek (List + Kanban drag-drop), **konversi Lead → Client**
- **Sales**: Store, Items, Orders, Contracts, Payments, Invoices (dengan line items & payments, **Edit Invoice**), **Export PDF**
- **Projects**: Manajemen proyek & detail proyek (List + Gantt)
- **Tasks**: Manajemen tugas (List + Kanban + Gantt)
- **Todo**: Per-user todo list
- **Events**: Kalender events
- **Files**: File manager — **upload & download berfungsi**, storage lokal persisten (Docker volume)
- **Expenses**: Pencatatan pengeluaran per-user
- **Notes**: Catatan per-user
- **Team**: Members, Time Cards (clock in/out dengan duration), Leave Management, Announcements
- **Reports**: Invoice summary, Projects summary, Leads funnel, Expenses total, **Export CSV (Excel)**
- **Settings**: Manajemen users, **Dynamic RBAC (App Roles + Permissions)**, **Audit Trail**

## Business Logic Penting

### Invoice Auto-Status
`recalcInvoice()` di `handlers.go` dipanggil setiap kali payment ditambah/dihapus atau item berubah.
Otomatis update `paid_amount`, `due_amount`, dan `status`:
- `paid >= total` → `fully_paid`
- `paid > 0` → `partially_paid`
- `paid == 0 && status != draft && due_date lewat` → `overdue`

### Lead → Client Conversion
`POST /api/v1/leads/:id/convert` — membuat Client baru dari data Lead, auto-set lead status ke `won`.
Di frontend: tombol "→ Client" di setiap baris list dan kanban card.

### Clock In/Out
- ClockIn: set `InTime` dan `InDate` ke `time.Now()`
- ClockOut: hitung `duration = now - InTime` dalam jam, simpan ke `TimeCard.Duration`

### Dashboard Stats
`GET /api/v1/dashboard` mengembalikan 22 field real-time:
task breakdown, invoice per-status amounts, project counts, clocked_in_count, on_leave_today, dll.

### Audit Trail
`recordAudit()` helper di `handlers.go` dipanggil otomatis di setiap operasi Create/Update/Delete/Convert untuk entitas: **Client, Project, Task, Lead, Invoice, Contract**.
- Model: `AuditLog` — menyimpan `user_id`, `action`, `entity_type`, `entity_id`, `entity_name`, `ip_address`, `created_at`
- Endpoint: `GET /api/v1/audit-logs` (Admin only) — support filter `entity_type`, `action`, `from`, `to`, `user_id`
- Frontend: halaman `Settings > Audit Trail` (`/settings/audit-log`)
- `AuditLog` tidak pakai soft delete — log bersifat immutable/permanen

### Project Auto-fill di Form Sales
Form Add/Edit di **Orders, Contracts, Invoices** mendukung auto-fill dari project yang dipilih:
- **Orders** (`OrdersPage`): `order_date` ← `project.start_date`, `amount` ← `project.price`, `client_id` ← `project.client_id`, `currency` ← `project.currency`
- **Contracts** (`ContractsPage`): `contract_date` ← `project.start_date`, `valid_until` ← `project.deadline`, `amount` ← `project.price`, `client_id` ← `project.client_id`, `currency` ← `project.currency`
- **Invoices** (`InvoicesPage`): `bill_date` ← `project.start_date`, `due_date` ← `project.deadline`, `total_amount` ← `project.price`, `client_id` ← `project.client_id`, `currency` ← `project.currency`

Saat project dipilih, field yang ter-auto-fill menampilkan hint biru di bawah field ("Auto-filled from project..."). Semua field tetap bisa diedit manual setelah auto-fill. Pattern menggunakan `setForm((f) => ({ ...f, project_id: pid, ...(proj ? { ... } : {}) }))`.

### Invoice PDF Export
`GET /api/v1/invoices/:id/pdf` — generate HTML invoice styled rapi.
Browser buka di tab baru dan auto-trigger `window.print()` → user simpan sebagai PDF.
Tombol printer ikon di setiap baris tabel InvoicesPage.

### Reports Export CSV
`GET /api/v1/reports/export?type=invoices&year=2026` — generate CSV dengan UTF-8 BOM agar Excel baca karakter Indonesia dengan benar.
Tipe tersedia: `invoices`, `expenses`, `leads`, `projects`, `timecards`.
Tombol "Export Excel" di header halaman Reports, otomatis download sesuai tab aktif.

### File Storage (Local)
- File tersimpan di disk dengan struktur `{uploadDir}/YYYY/MM/timestamp_namafile`
- Docker volume `uploads_data` di-mount ke `/app/uploads` — persisten antar redeploy
- Upload: `POST /api/v1/files/upload` — simpan file ke disk, catat metadata di DB
- Download: `GET /api/v1/files/:id/download` — download dengan autentikasi, cek kepemilikan
- Tombol Download (ikon) muncul saat hover di baris file di FilesPage

### Forgot Password & Reset Password
- `POST /api/v1/auth/forgot-password` — cari user by email, generate token 32-byte hex acak, simpan ke `User.ResetToken` + `User.ResetTokenExpiry` (1 jam), kirim email HTML via `net/smtp`
- `POST /api/v1/auth/reset-password` — verifikasi token & expiry, set password baru, hapus token dari DB
- Frontend: `ForgotPasswordPage` — form input email + pesan sukses; `ResetPasswordPage` — halaman di `/reset-password?token=xxx`
- Jika `SMTP_HOST` kosong, email tidak dikirim (aman untuk dev lokal — tidak error)

### JWT Token Invalidation (Logout)
- Setiap JWT sekarang punya `JTI` (JWT ID) — 16-byte hex acak, unik per token
- Logout: `POST /api/v1/auth/logout` — blacklist JTI dengan expiry sesuai token, menggunakan `sync.Map` in-memory
- Setiap request: `AuthRequired` middleware cek apakah JTI ada di blacklist sebelum lanjut
- Cleanup otomatis setiap 15 menit — hapus entry yang sudah expired
- Catatan: blacklist hilang saat server restart, tapi token lama tetap aman karena JWT expiry tetap berlaku

### Dynamic RBAC (App Roles & Permissions)
- **Dua layer role**: `role` string (`admin`/`member`) = system role (backward compat); `app_role_id` FK ke tabel `AppRole` = dynamic role
- **Admin**: selalu full access, permissions diabaikan
- **Member tanpa AppRole** (`app_role_id = NULL`): full access (backward compat)
- **Member dengan AppRole**: akses dibatasi sesuai `RolePermission` milik role tersebut
- **`nil permissions = full access`** — konvensi ini dipakai di frontend (`authSlice`) dan backend (`resolvePermissions`)
- Backend: `AppRole` model (name, description) + `RolePermission` model (app_role_id, menu, can_read, can_edit); ON DELETE CASCADE
- Backend endpoints (admin only CUD): `GET/POST/PUT/DELETE /api/v1/roles`, `PUT /api/v1/roles/:id/permissions`
- Login & `/auth/me` mengembalikan field `permissions` (array atau null) — disimpan di Redux + localStorage/sessionStorage
- Frontend: `canRead(permissions, role, menu)` dan `canEdit(permissions, role, menu)` di `authSlice.ts`
- Sidebar di `Layout.tsx` filter nav items via `canRead()` — menu yang tidak boleh diakses tidak muncul
- Halaman `Settings > Roles` (`/settings/roles`): CRUD role + permission matrix (15 menu, checkbox Read/Edit per baris)
- Halaman `Settings > Users`: dropdown "App Role" di Add/Edit modal — hanya muncul saat Role = Member
- Menu keys yang digunakan di permission matrix: `dashboard`, `events`, `clients`, `projects`, `tasks`, `leads`, `sales`, `notes`, `messages`, `team`, `files`, `expenses`, `reports`, `todo`, `settings`

### Sidebar Navigation (Layout.tsx)
Sidebar menggunakan struktur **grouped navigation** — bukan flat list. Tipe data:
```ts
type NavLeaf = { to: string; icon: LucideIcon; label: string; menu: string; comingSoon?: boolean }
type NavGroupDef = { id: string; label: string; items: NavLeaf[] }
```
**Grup yang ada** (urut dari atas):
- Dashboard (standalone, tanpa group header)
- Business & Sales → Clients, Leads, Orders, Contracts, Store, Items
- Operations → Projects, Tasks, To Do, Events
- Finance → Invoices, Payments, Expenses
- People → Team, Time Cards, Leave, Announcements
- Collaboration → Messages, Notes, Files
- Assets → Asset Management *(comingSoon: true — halaman belum ada)*
- Reports → Reports
- System → User Accounts, Roles, Audit Trail
- Help → Help

**Perilaku sidebar:**
- Default hanya grup yang mengandung route aktif yang di-expand (auto-detect via `useState` initializer)
- Sidebar selalu `fixed` di semua breakpoint — tidak ada `lg:static` override
- Main content pakai `ml-72` / `ml-0` dengan `transition-[margin]` untuk animasi smooth
- Tombol hamburger di header dan tombol X di dalam sidebar keduanya berfungsi di desktop & mobile

**Logo sidebar:** inline CSS gradient text `nexora` (`bg-gradient-to-r from-blue-400 via-purple-400 to-yellow-400`) + subtitle "Part of CBQA Global Group"

**Ukuran nav item:** icon 18px, text 15px, `gap-3`, `py-2.5`, `rounded-lg`

## API Endpoints Backend

### Auth (public)
| Method | Path | Keterangan |
|--------|------|-----------|
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/register` | Register user baru |
| POST | `/api/v1/auth/forgot-password` | Kirim email reset password |
| POST | `/api/v1/auth/reset-password` | Reset password dengan token |

### Auth (protected)
| Method | Path | Keterangan |
|--------|------|-----------|
| GET | `/api/v1/auth/me` | Info user saat ini |
| POST | `/api/v1/auth/logout` | Logout + invalidate token |
| PUT | `/api/v1/auth/change-password` | Ganti password |

### Files
| Method | Path | Keterangan |
|--------|------|-----------|
| GET | `/api/v1/files` | List file/folder milik user |
| POST | `/api/v1/files/upload` | Upload file (simpan ke disk) |
| POST | `/api/v1/files/folder` | Buat folder baru |
| GET | `/api/v1/files/:id/download` | Download file (auth required) |
| DELETE | `/api/v1/files/:id` | Hapus file/folder |
| PATCH | `/api/v1/files/:id/favorite` | Toggle favorit |

### Reports
| Method | Path | Keterangan |
|--------|------|-----------|
| GET | `/api/v1/reports/invoices-summary` | Ringkasan invoice per klien |
| GET | `/api/v1/reports/projects-summary` | Ringkasan status proyek |
| GET | `/api/v1/reports/leads-summary` | Funnel leads per status |
| GET | `/api/v1/reports/expenses-summary` | Total pengeluaran |
| GET | `/api/v1/reports/export?type=X&year=Y` | Export CSV — type: invoices/expenses/leads/projects/timecards |

### Audit Logs (Admin only)
| Method | Path | Keterangan |
|--------|------|-----------|
| GET | `/api/v1/audit-logs` | List audit log dengan filter |

### App Roles (Admin only untuk CUD)
| Method | Path | Keterangan |
|--------|------|-----------|
| GET | `/api/v1/roles` | List semua app roles |
| POST | `/api/v1/roles` | Buat role baru (admin only) |
| GET | `/api/v1/roles/:id` | Detail role + permissions (admin only) |
| PUT | `/api/v1/roles/:id` | Update nama/deskripsi role (admin only) |
| DELETE | `/api/v1/roles/:id` | Hapus role (admin only) |
| PUT | `/api/v1/roles/:id/permissions` | Set permission matrix (admin only) |

## API Services di Frontend (`src/services/api.ts`)
Setiap modul punya service object:
- `authService` — login, register, me, logout, forgotPassword, resetPassword (via `api.post('/auth/reset-password')`)
- `dashboardService`, `clientService`, `projectService`, `taskService`
- `leadService`, `invoiceService`, `paymentService`, `contractService`, `itemService`
- `orderService`, `eventService`, `noteService`, `expenseService`, `fileService`
- `todoService`, `teamService`, `labelService`
- `reportService` — termasuk `exportCSV(type, year)` untuk download CSV
- `auditService` — `list(params)` → `GET /api/v1/audit-logs`
- `invoicePDFService` — `openPDF(id)` → buka PDF di tab baru
- `roleService` — list, get, create, update, delete, setPermissions → `GET/POST/PUT/DELETE /api/v1/roles`

## Coding Conventions

### Frontend (React/TypeScript)
- Gunakan **functional components** dengan hooks
- File komponen menggunakan ekstensi `.tsx`
- Penamaan file: **PascalCase** (contoh: `ClientDetailPage.tsx`)
- Semua API calls melalui service object di `src/services/api.ts`
- Utility functions di `src/utils/format.ts`
- Shared components di `src/components/common/`
- Layout wrapper di `src/components/layout/`
- Jangan gunakan `any` di TypeScript kecuali terpaksa
- Gunakan Tailwind CSS untuk styling, hindari inline style

### Backend (Golang)
- Ikuti struktur **Clean Architecture**: cmd → internal → handlers → models
- Error handling eksplisit, jangan abaikan error
- Gunakan **idiomatic Go**: error sebagai return value kedua
- Config dari environment variables via `internal/config`
- Database logic di `internal/database`
- Business logic di `internal/handlers`
- Model/struct definisi di `internal/models`
- Semua model menggunakan `gorm.DeletedAt` (soft delete) — **kecuali `AuditLog`** (immutable)
- Tanggal menggunakan tipe `FlexTime` (wrapper `time.Time` yang menerima RFC3339 dan `YYYY-MM-DD`)
- Email dikirim secara `goroutine` (non-blocking) agar tidak delay HTTP response

## Hal yang JANGAN Dilakukan
- Jangan tambah dependency baru tanpa diskusi
- Jangan gunakan `any` di TypeScript
- Jangan bypass middleware auth untuk route yang butuh autentikasi
- Jangan hardcode config/credentials — gunakan `.env`
- Jangan campur business logic dengan database logic
- Jangan commit `Frontend/dist/`, `node_modules/`, `.env`, `Backend/api.exe`
- Jangan hapus atau soft-delete record `AuditLog` — log harus immutable
- Jangan hapus file fisik dari disk tanpa menghapus record DB-nya juga (dan sebaliknya)

## Environment

File `.env` ada di root repo (dibaca docker-compose) dan `Backend/.env` (untuk run manual).
Jangan commit `.env` — sudah ada di `.gitignore`.

### Semua env vars yang digunakan:
```env
# App
ENV=production
PORT=8080
APP_URL=https://yourdomain.com

# Database
DB_HOST=postgres          # gunakan 'localhost' untuk run manual
DB_PORT=5432
DB_USER=cbqa
DB_PASSWORD=cbqa123
DB_NAME=cbqa_db

# Auth
JWT_SECRET=ganti-dengan-secret-yang-kuat
JWT_EXP_HOURS=24

# File Storage (docker-compose sudah set otomatis, tidak perlu diubah)
UPLOAD_DIR=/app/uploads

# SMTP (untuk forgot password — jika kosong, email tidak dikirim)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@cbqa.com

# PostgreSQL (untuk postgres container)
POSTGRES_USER=cbqa
POSTGRES_PASSWORD=cbqa123
POSTGRES_DB=cbqa_db

# pgAdmin (opsional)
PGADMIN_DEFAULT_EMAIL=admin@cbqa.com
PGADMIN_DEFAULT_PASSWORD=admin123
```

Version app ada di dua tempat (update keduanya saat bump versi):
- `Backend/internal/server/server.go` — health endpoint `{"version":"x.x.x"}`
- `Frontend/src/components/layout/Layout.tsx` — teks versi di sidebar footer

### Login Page (LoginPage.tsx)
Diambil dari project NEXONE (`/Users/harmanto/Documents/Code/PROD/NEXONE`). Halaman login dua-panel (split screen):
- **Mobile**: dark navy background dengan animated orbs, logo Nexora dengan glow, SVG network diagram, form card di bawah
- **Desktop**: left panel putih (form login), right panel pakai `FrameKanan.png` sebagai background
- Asset PNG: `Frontend/logo/Logo_Nexora_Part.png` dan `Frontend/logo/FrameKanan.png` (di-copy dari NEXONE)
- Import path: `'../../../logo/FrameKanan.png'` dan `'../../../logo/Logo_Nexora_Part.png'`

### Sidebar (Layout.tsx)
Diambil dari project NEXONE. Logo sidebar: gradient text "nexora" + subtitle "Bagian dari CBQA Global Group".
Nav config di `src/config/navigation.ts` — urutan Business & Sales: **Leads** → Clients (bukan Clients → Leads).

## Cara Jalankan Manual (tanpa Docker)

### Prasyarat (install sekali)
```bash
brew install go postgresql@15
brew services start postgresql@15
psql postgres -c "CREATE USER cbqa WITH PASSWORD 'cbqa123';"
psql postgres -c "CREATE DATABASE cbqa_db OWNER cbqa;"
```

### Jalankan App
```bash
# Tab 1 - Backend
cd Backend
go run cmd/api/main.go

# Tab 2 - Frontend
cd Frontend
npm install   # pertama kali saja
npm run dev
```

Akses di http://localhost:3000 (atau 3001 jika port 3000 sedang dipakai)

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
curl http://localhost:8080/health
# {"status":"ok","version":"1.0.2"}
```

## Docker (Full Stack)
```bash
# Pastikan .env ada di root
docker-compose up --build   # build & jalankan semua
docker-compose down          # stop semua
docker-compose --profile tools up  # jalankan + pgAdmin (localhost:5050)
```

Volume yang digunakan:
- `postgres_data` — data PostgreSQL
- `uploads_data` — file yang diupload user (mount ke `/app/uploads` di container backend)

## GitHub
- Remote PUSINTEK: https://github.com/Nexora-Tech-Team/PUSINTEK-NEXONE (branch: main)
- Remote NEXONE: https://github.com/Nexora-Tech-Team/NEXONE (branch: Dev_Har)
- Struktur root: `Backend/`, `Frontend/`, `docker-compose.yml`

## Changelog

### v1.0.3 (2026-04-27)
**UI Overhaul:**
- Sidebar grouped navigation — nav distruktur ulang dari flat list ke `NavGroupDef[]` dengan 10 grup (Business & Sales, Operations, Finance, People, Collaboration, Assets, Reports, System, Help)
- Sidebar auto-expand grup aktif berdasarkan route saat ini; grup lain collapsed by default
- Sidebar hide/show fix — hapus `lg:static lg:translate-x-0` override; sidebar kini `fixed` di semua breakpoint, main content pakai `ml-72`/`ml-0` transition
- Sidebar logo — CBQA PNG diganti inline CSS gradient text "nexora"
- Nav item sizing disesuaikan untuk keterbacaan usia 40-50: icon 18px, text 15px, padding `py-2.5`
- Login page revamp — desain dua-panel baru: left panel bersih (form dengan field labels, tanpa social login, tanpa bg image), right panel dengan feature grid 2 kolom + CSS dashboard mockup
- Login page logo baru — "NEXONE by NEXORA" dengan inline SVG geometric mark

### v1.0.2 (2026-04-26)
**Fitur baru:**
- Audit Trail — rekaman otomatis Create/Update/Delete/Convert untuk Client, Project, Task, Lead, Invoice, Contract
- Invoice PDF Export — generate & print invoice langsung dari browser
- Reports Export CSV — download laporan ke CSV (bisa dibuka di Excel) untuk semua tab Reports
- Dynamic RBAC — admin buat App Role, set permission matrix per menu (Read/Edit), assign ke user Member
- Invoices Edit — tombol Edit di tiap baris tabel, modal reuse form Add dengan pre-fill data existing
- Project Auto-fill — form Orders/Contracts/Invoices auto-fill tanggal, amount, client, currency dari project yang dipilih
- Payments Search — server-side search (debounce 300ms) across invoice number, client name, payment method, note; tambah kolom Client
- FormField hint — teks biru di bawah field saat value di-auto-fill dari project

**Sprint 1 Critical Fix:**
- File Storage — file upload sekarang benar-benar tersimpan ke disk, download berfungsi, Docker volume persisten
- Forgot Password — kirim email reset via SMTP (`net/smtp` stdlib), token berlaku 1 jam, halaman `/reset-password?token=xxx`
- JWT Logout — token di-blacklist (in-memory `sync.Map`) saat logout, tidak bisa dipakai lagi; cleanup otomatis setiap 15 menit
- Clock In/Out — dispatch `fetchMe()` setelah clock action di DashboardPage DAN TimeCardsPage agar Redux state `user.clocked_in` terupdate; card Dashboard berubah hijau (gradient) saat clocked in; tambah guard `if user.clocked_in` sebelum clock-in dan sebaliknya
- Dashboard My Tasks — `loadData(uid)` menerima `uid` sebagai parameter; `useEffect` depend on `user?.id` sehingga re-fetch saat Redux state hydrated (fix race condition)
- Login — trim whitespace email sebelum dispatch untuk cegah validasi 400

**Bug fix:**
- Deploy: ganti `fuser -k` dengan `docker rm -f` untuk benar-benar release port 8080 saat redeploy

### v1.0.1
- Initial production release
- Clean repo structure

### v1.0.0
- Init project
