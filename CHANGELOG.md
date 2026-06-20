# Changelog

> **Status Prod (2026-05-27 — update terakhir):**
> Branch `main` di origin = commit `94fe127` (fix: recalc all project progress on startup)
> Branch `archie-full-power` = **7 commit ahead** dari main, belum di-merge/deploy
> Working tree = **17 file modified + 3 untracked** — semua belum di-commit, siap naik ke prod

---

## PENDING COMMIT — 2026-05-27 (4)

### Feat: Leave Approval Workflow

**Konteks:**
Member harus mendapat persetujuan admin sebelum cuti disetujui. Admin bisa approve untuk dirinya sendiri secara langsung.

**Perubahan:**

#### `Backend/internal/models/models.go`
- Struct `Leave` — tambah field:
  - `ApprovedByID *uint` — siapa yang approve
  - `ApprovedBy *User` (FK `approved_by_id`) — relasi ke user

#### `Backend/internal/handlers/handlers.go`
- `ListLeaves`:
  - Admin → return semua leaves dari semua user, Preload User + ApprovedBy, order by `created_at desc`
  - Member → return hanya leaves milik sendiri
- `ApplyLeave`:
  - Admin → `status = approved`, `approved_by_id = diri sendiri` (auto-approve)
  - Member → `status = pending` (menunggu persetujuan)
  - Response Preload user & approved_by
- `UpdateLeaveStatus` — guard: hanya admin (return 403 jika bukan admin), validasi status hanya `approved`/`rejected`, set `approved_by_id`
- `DeleteLeave` *(handler baru)* — Admin: hapus apapun. Member: hanya pending milik sendiri (403 jika milik orang lain, 400 jika sudah approved/rejected)

#### `Backend/internal/server/server.go`
- Tambah route: `DELETE /api/v1/team/leaves/:id`

#### `Frontend/src/services/api.ts`
- Tambah `teamService.deleteLeave(id)`

#### `Frontend/src/pages/Team/LeavePage.tsx` — full rewrite
- Baca role dari Redux store (`user.role === 'admin'`)
- **Admin view:**
  - Tabel tampilkan kolom: Karyawan, Jenis Cuti, Mulai, Selesai, Durasi, Alasan, Status, Disetujui Oleh, Aksi
  - Tombol ✅ Setujui + ❌ Tolak per baris pending
  - Tombol 🗑 Hapus untuk semua baris
  - Modal submit berlabel "Simpan & Setujui" (langsung approved)
- **Member view:**
  - Tabel hanya tampilkan leaves sendiri
  - Banner info kuning: "Menunggu persetujuan admin"
  - Tombol 🗑 Batalkan hanya untuk status pending
- **Filter tab status:** Semua / Pending / Approved / Rejected
  - Badge counter merah di tab Pending jika ada yang menunggu

---

## PENDING COMMIT — 2026-05-27 (5)

### Feat: Dashboard — Project Overview 5 Status

**Konteks:**
Dashboard hanya menampilkan 3 status proyek (Open, Completed, Hold). Diperlukan tampilan lengkap sesuai status di Project Detail, dan klik langsung filter ke halaman project.

**Perubahan:**

#### `Backend/internal/handlers/handlers.go`
- Struct stats `GetStats` — tambah field:
  - `InProgressProjects int64` (`json:"in_progress_projects"`)
  - `CancelledProjects int64` (`json:"cancelled_projects"`)
- Tambah query count:
  - `WHERE status = 'in_progress'` → `InProgressProjects`
  - `WHERE status = 'cancelled'` → `CancelledProjects`

#### `Backend/internal/models/models.go`
- Komentar status Project diperbarui: `// open, in_progress, completed, hold, cancelled`

#### `Frontend/src/pages/Dashboard/DashboardPage.tsx`
- `EMPTY_STATS` tambah: `in_progress_projects: 0`, `cancelled_projects: 0`
- `projectTotal` sekarang mencakup semua 5 status
- Grid project overview: **3 kartu → 5 kartu** (`grid-cols-5`)
  - Open → slate, link ke `?status=open`
  - On Progress → biru, link ke `?status=in_progress`
  - Complete → emerald, link ke `?status=completed`
  - On Hold → amber, link ke `?status=hold`
  - Cancelled → merah, link ke `?status=cancelled`

#### `Frontend/src/pages/Projects/ProjectsPage.tsx`
- `statusFilter` init dari `searchParams.get('status') || ''`
- `showFilters` otomatis `true` jika ada `?status=` di URL

---

## PENDING COMMIT — 2026-05-27 (3)

### Fix: Validasi Duplikat — Leads & Clients

**Masalah:**
- `Lead.Create` dan `Lead.Update` tidak punya cek duplikat sama sekali
- `Client.Update` tidak cek duplikat (bisa overwrite nama/email ke yang sudah ada)
- Frontend hanya tampil pesan generik `'Failed to save'` — pesan 409 dari server tidak sampai ke user

**Perubahan:**

#### `Backend/internal/handlers/handlers.go`
- `LeadHandler.Create` — tambah cek duplikat: **name** (case-insensitive), **email** (jika diisi), **phone** (jika diisi) → return 409 + pesan spesifik
- `LeadHandler.Update` — tambah cek duplikat (exclude self by ID); fix `ShouldBindJSON` error sebelumnya diabaikan
- `ClientHandler.Update` — tambah cek duplikat **name** dan **email** (exclude self by ID)

#### `Frontend/src/pages/Leads/LeadsPage.tsx`
- `handleSave` catch: `catch (e: any) { toast.error(e?.response?.data?.error || 'Failed to save lead') }`

#### `Frontend/src/pages/Clients/ClientsPage.tsx`
- `handleSave` catch: `catch (e: any) { toast.error(e?.response?.data?.error || 'Failed to save client') }`

**Pesan error yang sekarang muncul ke user:**
- "Lead dengan nama ini sudah terdaftar"
- "Email ini sudah digunakan lead lain"
- "Nomor telepon ini sudah digunakan lead lain"
- "Client dengan nama ini sudah terdaftar"
- "Email ini sudah terdaftar untuk client lain"

---

## PENDING COMMIT — 2026-05-27 (belum di-commit ke branch, bagian dari Asset module)

### Feat: Module Asset Management (baru) + Fix: Error Handling & Master Data CRUD
*(detail lengkap di section 2026-05-27 (2) dan (3) di bawah)*

**File uncommitted:**
- `Backend/internal/handlers/asset.go` *(new)*
- `Backend/internal/handlers/handlers.go` *(modified — format currency + duplikat validation)*
- `Backend/internal/handlers/quotation.go` *(modified — format currency)*
- `Backend/internal/models/models.go` *(modified — Asset + AssetMasterData model)*
- `Backend/internal/server/server.go` *(modified — asset routes)*
- `Backend/internal/database/database.go` *(modified — auto-migrate Asset + AssetMasterData)*
- `Frontend/src/pages/Assets/AssetsPage.tsx` *(new)*
- `Frontend/src/services/api.ts` *(modified — assetService + assetSettingsService)*
- `Frontend/src/App.tsx` *(modified — route /assets)*
- `Frontend/src/config/navigation.ts` *(modified — Assets nav aktif)*
- `Frontend/src/pages/Sales/QuotationsPage.tsx` *(modified — filter by client)*
- `Frontend/package.json` + `package-lock.json` *(modified — qrcode.react, html5-qrcode)*
- `Frontend/vite.config.ts` *(modified)*
- `CHANGELOG.md` *(new)*

---

## PENDING MERGE TO MAIN — branch `archie-full-power` (7 commits, belum di-deploy)

| Commit | Tanggal | Deskripsi |
|--------|---------|-----------|
| `8af210b` | 2026-05-26 | chore: update login hero image |
| `b8eceb0` | 2026-05-26 | fix: filter quotation projects by client |
| `69856c4` | 2026-05-26 | fix: filter contract projects by client |
| `50f8dd5` | 2026-05-17 | fix: archive lead after client conversion |
| `25f5168` | 2026-05-17 | feat: standardize table numbering and pagination |
| `55e7503` | 2026-05-14 | feat: add executive WhatsApp prompts |
| `1c200f9` | 2026-05-14 | feat: merge full-power features with WhatsApp assistant |

**File total berubah vs main:** 53 file (+4165 / -444 lines)

**Fitur utama yang belum di-prod:**
- WhatsApp Assistant terintegrasi (handler `whatsapp.go`, `MessagesPage.tsx` upgrade besar)
- Module Clusters (`ClustersPage.tsx` baru)
- Reports page upgrade besar (`ReportsPage.tsx`)
- Project Detail upgrade besar (`ProjectDetailPage.tsx`)
- Tasks upgrade besar (`TasksPage.tsx`)
- Standardisasi pagination & row numbering di semua tabel
- Login hero image update
- Filter quotation/contract by client
- Arsip lead otomatis saat convert ke client

---

## 2026-05-27

### Fix: Format Angka di Print Layout — Thousand Separator

**Masalah:**
Nominal di halaman cetak (Invoice PDF & Quotation PDF) tidak menggunakan separator ribuan,
sehingga angka tampil seperti `IDR 1500000.00` — sulit dibaca.

**Perubahan:**

#### `Backend/internal/handlers/handlers.go`
- Fungsi `formatCurrency` di template Invoice PDF diubah:
  - Sebelum: `fmt.Sprintf("%s %.2f", currency, amount)` → `IDR 1500000.00`
  - Sesudah: separator `.` per seribu, koma `,` untuk desimal → `IDR 1.500.000,00`

#### `Backend/internal/handlers/quotation.go`
- Fungsi `formatCurrency` di template Quotation PDF disamakan:
  - Sebelum: `fmt.Sprintf("%s %.2f", currency, amount)` → `IDR 1500000.00`
  - Sesudah: `IDR 1.500.000,00`
- Catatan: `formatRp` (dipakai di baris item quotation) sudah benar sejak awal — tidak diubah.

**Format hasil:**
```
IDR 1.500.000,00
USD 2.350,50
```

---

## 2026-05-27 (2)

### Feat: Module Asset Management (baru)

**Backend:**
- `Backend/internal/models/models.go` — tambah model `Asset` (28 field: asset_code, name, category, brand, asset_model, serial_number, barcode, purchase_date, purchase_price, depreciation_pct, currency, location, condition, status, notes, file_url, assigned_to, project, expense)
- `Backend/internal/handlers/asset.go` — handler baru: List, Create, Get, Update, Delete, Scan, Export CSV. Includes `computeAssetCurrentValue()` — hitung nilai saat ini otomatis dari depresiasi tahunan (compound depreciation)
- `Backend/internal/server/server.go` — routes baru di `/api/v1/assets`: GET/POST/GET:id/PUT:id/DELETE:id (admin only), GET /scan, GET /export

**Frontend:**
- `Frontend/src/pages/Assets/AssetsPage.tsx` — halaman baru lengkap:
  - Tabel aset dengan filter kategori / status / kondisi + search
  - Stats bar: total, aktif, maintenance, disposed+lost
  - Modal Add/Edit (13 field + relasi ke User/Project/Expense)
  - **QR Code modal** per aset — bisa print (`qrcode.react`)
  - **Scanner modal** — scan via kamera atau input manual (`html5-qrcode`), lookup ke backend, tampilkan detail aset
  - Export CSV
- `Frontend/src/services/api.ts` — tambah `assetService` (list, get, create, update, delete, scan, export)
- `Frontend/src/App.tsx` — tambah route `/assets`
- `Frontend/src/config/navigation.ts` — hapus `comingSoon: true` dari item Assets

**Dependencies baru (npm):** `qrcode.react`, `html5-qrcode`

---

## 2026-05-27 (3)

### Fix: Asset Module — Error Handling & Master Data CRUD

**Masalah yang dilaporkan:**
1. "Gagal memuat data aset" muncul saat belum ada data (list endpoint 404/kosong)
2. Tidak ada UI untuk kelola Kategori, Status, Kondisi (add/edit/delete)
3. "Gagal menyimpan aset" — tidak jelas penyebabnya

**Perubahan:**

#### Backend
- `Backend/internal/models/models.go` — tambah model `AssetMasterData` (type: category/status/condition, name, color, description) menggantikan hardcoded constants
- `Backend/internal/handlers/asset.go` — tambah `AssetMasterDataHandler` (List filter by type, Create, Update, Delete dengan proteksi: tidak bisa hapus jika nilai masih dipakai aset)
- `Backend/internal/server/server.go` — routes baru di `/api/v1/asset-settings` (GET/POST/PUT:id/DELETE:id admin-only)
- **Docker rebuild** — `archie-local-backend` direbuild dengan image baru agar routes `/assets` dan `/asset-settings` tersedia

#### Frontend — `Frontend/src/pages/Assets/AssetsPage.tsx`
- **Silent error on list**: `.catch()` sekarang `setAssets([]); setTotal(0)` — tidak tampilkan toast saat data kosong atau backend belum ada data
- **Master Data tab** (sub-tab Kategori / Status / Kondisi): CRUD penuh via `assetSettingsService`
  - Tambah, edit (nama & warna), hapus (dengan konfirmasi)
  - Dropdown di form Add/Edit aset sekarang dinamis dari API
  - Fallback ke preset bawaan jika API kosong
- **Error save**: tampilkan pesan backend yang sebenarnya (`e?.response?.data?.error || 'Gagal menyimpan aset'`)

#### Frontend — `Frontend/src/services/api.ts`
- Tambah `assetSettingsService` (list, create, update, delete)

---
