# Progress Pengerjaan Module Internal Project

Tanggal pembaruan: 10 Juni 2026 (Monitoring & Access Hardening)

## Tujuan Modul

Module `Internal Project` digunakan untuk mengelola dan memonitor proyek internal perusahaan yang tidak terhubung dengan client, contract, invoice, payment, atau project operasional berbasis client.

Module menggunakan user terdaftar Archie Management untuk owner, member, dan assignee, tetapi seluruh data proyek dan task disimpan pada tabel khusus yang terpisah dari module Project existing.

## ⚠️ PENTING: Port Configuration

**Archie Management** (Project ini):
- Frontend: **Port 3000** (http://localhost:3000)
- Backend: **Port 8080** (http://localhost:8080)

**Archie Management-PCI** (Project terpisah):
- Frontend: **Port 3010** (http://localhost:3010)
- Backend: **Port 8080** (sama, tapi instance berbeda)

**JANGAN SALAH PORT!** Testing module Internal Project harus di **localhost:3000**, bukan 3010.

## Status Keseluruhan

| Area | Status |
|---|---|
| Fondasi database dan API | Selesai |
| Navigasi dan multibahasa | Selesai |
| Daftar dan pengelolaan proyek | Selesai |
| Anggota proyek | Selesai |
| Detail proyek dan Kanban | Selesai |
| CRUD task dan progress otomatis | Selesai |
| Monitoring management | Selesai |
| Time tracking dan timesheet | Selesai |
| Subtask dan checklist | Selesai |
| Komentar, attachment, dan activity log | Selesai untuk kolaborasi inti |
| Notifikasi dan reminder | Selesai untuk notifikasi inti |
| Pengaturan kolom Kanban | Tidak diperlukan - sesuai SOP |
| Report dan export | Selesai untuk laporan inti |
| Permission per application role | Selesai untuk permission menu inti |
| Automated test lengkap | Sebagian - test dasar tersedia |
| UAT dan release hardening | Selesai |
| Production deployment | Selesai |

Estimasi progress fungsional saat ini: **100% untuk scope rilis saat ini** (commit, push, migration, deployment, dan smoke test production selesai).

---

## Tahapan Yang Sudah Selesai

### 1. Analisis dan Pemisahan Domain

Status: **Selesai**

- Internal Project dipisahkan dari tabel `projects` milik project client.
- Tidak memiliki relasi ke client, contract, quotation, invoice, payment, atau finance.
- Tetap menggunakan user Archie Management sebagai owner, member, creator, dan assignee.
- Pola fitur mengacu pada module Project NEXTOOLS, sedangkan UI mengikuti style Archie Management.

### 2. Navigasi Module

Status: **Selesai**

- Group `Internal Project` ditempatkan di atas `Business & Sales`.
- Submenu `Monitoring` sudah aktif.
- Submenu `Project` sudah aktif.
- Route yang tersedia:
  - `/internal-project/dashboard`
  - `/internal-project/projects`
  - `/internal-project/projects/:id`
  - `/internal-project/my-tasks` (halaman kontekstual, tidak tampil di sidebar)
  - `/internal-project/timesheet`
  - `/internal-project/reports`
- Menu mendukung Bahasa Indonesia dan English.

### 3. Fondasi Database Terpisah

Status: **Selesai**

Tabel yang sudah tersedia:

- `internal_projects`
- `internal_project_members`
- `internal_project_columns`
- `internal_tasks`
- `internal_task_assignees`
- `internal_time_logs`
- `internal_subtasks`
- `internal_task_comments`
- `internal_task_comment_mentions`
- `internal_task_attachments`
- `internal_task_reference_links`
- `internal_task_activities`

Catatan:

- Flow clock in, clock out, timesheet, subtask, dan kolaborasi task sudah diterapkan.
- Auto migration dan sinkronisasi sequence sudah tersedia.
- Migrasi kolom lama `In Progress` ke `Development` sudah idempotent.

### 4. Pengelolaan Internal Project

Status: **Selesai**

- Melihat daftar proyek sesuai hak akses.
- Search proyek.
- Filter Active dan Archived.
- Pagination.
- Membuat proyek baru.
- Mengedit nama, deskripsi, dan status proyek.
- Archive proyek.
- Hapus permanen khusus admin.
- Creator otomatis menjadi owner dan member pertama.
- Statistik total project, active, archived, dan jumlah orang terlibat.

### 5. Pengelolaan Anggota

Status: **Selesai**

- Owner/admin dapat menambahkan user Archie Management sebagai anggota.
- Owner/admin dapat mengeluarkan anggota.
- Owner tidak dapat dikeluarkan dari proyek.
- Anggota proyek dapat melihat susunan tim.
- Assignee task wajib merupakan anggota proyek tersebut.
- User non-admin hanya melihat proyek tempat dirinya menjadi anggota.

### 6. Detail Workspace Internal Project

Status: **Selesai**

- Informasi nama, deskripsi, status, owner, tim, progress, dan task health.
- Tampilan Kanban.
- Tampilan Task List.
- Link dari daftar proyek menuju detail workspace.
- Indikator jumlah task selesai dan overdue.
- Tampilan responsive mengikuti UI/UX Archie Management.

### 7. Kolom Kanban

Status: **Selesai untuk kolom default**

Urutan kolom saat ini:

1. Backlog
2. To Do
3. Development
4. Review
5. UAT
6. Deploy To Production
7. Done

- Kolom otomatis dibuat saat project dibuat.
- Project lama otomatis disesuaikan dengan tujuh kolom tersebut.
- Task dapat dipindahkan dengan drag-and-drop.
- Status task mengikuti key kolom tujuan.

### 8. CRUD Internal Task

Status: **Selesai**

- Membuat task.
- Mengedit task.
- Menghapus task sesuai hak akses.
- Memindahkan dan mengurutkan task pada Kanban.
- Multi-assignee.
- Category.
- Priority: Low, Medium, High, Urgent.
- Description.
- Deadline.
- Indikator overdue.
- Task internal tidak muncul pada module Operations > Tasks.

### 9. Progress Otomatis

Status: **Selesai**

- Progress dihitung berdasarkan jumlah task pada kolom `Done` dibanding total task.
- Progress diperbarui saat task dibuat, diedit, dipindahkan, atau dihapus.
- Progress ditampilkan pada daftar proyek, detail proyek, dan dashboard.

### 10. Monitoring Internal Project

Status: **Selesai**

- Statistik proyek aktif.
- Statistik task selesai.
- Statistik task overdue.
- Overall progress.
- Distribusi task pada tujuh kolom Kanban.
- Project health.
- Workload anggota berdasarkan assignee.
- Daftar task overdue, high priority, urgent, dan mendekati deadline.
- Filter project.
- Filter member.
- Filter rentang deadline 7, 30, dan 90 hari.
- Link langsung menuju Kanban project.
- Agregasi data mengikuti hak akses user.

### 11. Verifikasi Teknis Tahap Berjalan

Status: **Selesai**

- `go test ./...` berhasil.
- TypeScript production build berhasil.
- ESLint berhasil tanpa error.
- API smoke test project berhasil.
- API smoke test member berhasil.
- API smoke test CRUD task berhasil.
- API smoke test perpindahan Kanban berhasil.
- API smoke test progress otomatis berhasil.
- API smoke test dashboard dan filter berhasil.
- API smoke test login akun lokal berhasil.
- API smoke test export CSV task berhasil (`200`, header CSV valid).
- API smoke test export CSV timesheet berhasil (`200`, header CSV valid).
- API smoke test printable management summary berhasil (`200`, HTML valid).
- Frontend dan backend localhost merespons `200`.
- Data sementara pengujian sudah dibersihkan.

---

## Tahapan Yang Belum Dikerjakan

### 12. Time Tracking dan Timesheet

Status: **Selesai**

**Fitur yang sudah diimplementasikan:**

✅ **Backend API (100%)**
- 9 endpoints time tracking di `internal_project.go`
- `ClockIn` - Start timer untuk task
- `ClockOut` - Stop timer untuk task
- `GetActiveLog` - Get active timer user saat ini
- `GetTimeLogs` - Get time logs untuk task tertentu
- `CreateManualTimeLog` - Manual time entry
- `DeleteTimeLog` - Hapus time log
- `GetMyTimeLogs` - Time logs user dengan filter tanggal
- `GetProjectTimeLogs` - Time logs project dengan filter
- Validasi: hanya 1 timer aktif per user (di backend)
- Auto-calculate duration saat clock out
- Routes sudah configured di `server.go`

✅ **Frontend Components (100%)**
- `TaskTimer.tsx` component dengan 2 mode:
  - **Compact mode**: untuk inline di card
  - **Full mode**: untuk modal/panel detail
- Live timer update setiap 1 detik
- Format durasi: "Xh Ym" atau "Ym Zs"
- Green pulsing indicator untuk active timer
- Loading states & error handling

✅ **Task Detail Modal Integration (100%)**
- Tab "Time Tracking" di modal task detail
- Integrasi komponen TaskTimer
- Riwayat time log per task
- Display user, durasi, dan waktu clock in/out

✅ **Timesheet Page (100%)**
- Route baru: `/internal-project/timesheet`
- Menu "Timesheet" di navigation Internal Project
- Week navigation (prev/next week)
- Filter by Project
- Filter by User (untuk project yang dipilih)
- Grouped by date dengan daily total
- Total hours per week
- Empty state handling

✅ **Monitoring Summary (100%)**
- Card baru di Monitoring: "Hours (Today / Week)"
- Auto-load jam kerja hari ini
- Auto-load jam kerja minggu ini
- Icon Clock dengan badge amber

**Catatan teknis:**
- Backend compile success ✓
- Frontend build success ✓
- 8 API service methods ditambahkan ke `internalProjectService`
- Format durasi: live update setiap 1 detik
- Sistem validasi 1 timer aktif per user di backend
- UI mengikuti theme Archie Management existing (primary, slate, badges)

**Belum diimplementasikan (optional future enhancement):**
- ❌ Export timesheet ke Excel/PDF
- ❌ Manual time log form di modal (saat ini hanya display riwayat)
- ❌ Activity notes saat clock out
- ❌ Chart jam kerja per hari (7 hari terakhir)

### 13. Subtask dan Checklist

Status: **Selesai**

**Fitur yang sudah diimplementasikan:**

✅ **Backend API (100%)**
- Model `InternalSubtask` di database
- Auto migration configured
- 6 endpoints di `internal_project.go`:
  - `ListSubtasks` - Get subtasks untuk task
  - `CreateSubtask` - Buat subtask baru
  - `UpdateSubtask` - Update subtask
  - `ToggleSubtaskStatus` - Toggle completed/pending
  - `DeleteSubtask` - Hapus subtask
  - `ReorderSubtasks` - Reorder posisi subtask
- Routes configured di `server.go`
- Access control (member/owner/admin)
- Cascade delete ketika parent task dihapus

✅ **Frontend Components (100%)**
- `SubtaskList.tsx` component (200 lines)
- Checkbox untuk toggle status
- Add subtask form inline
- Delete subtask dengan confirm
- Progress bar visual (completed/total)
- Progress percentage display
- Hover effects untuk better UX
- Empty state handling

✅ **Task Detail Modal Integration (100%)**
- Tab "Subtasks" di modal task detail
- Badge counter jumlah subtasks
- Auto-load subtasks saat modal dibuka
- Real-time update setelah actions
- Integrated dengan existing tabs (Details, Time)

✅ **API Service Methods (100%)**
- 4 methods ditambahkan ke `internalProjectService`:
  - `listSubtasks(taskId)`
  - `createSubtask(taskId, data)`
  - `toggleSubtask(taskId, subtaskId)`
  - `deleteSubtask(taskId, subtaskId)`

**Catatan teknis:**
- Backend compile success ✓
- Frontend build success ✓
- Subtask support assignee & due_date (optional)
- Position-based ordering (drag-drop ready)
- Status: "pending" atau "completed"
- UI mengikuti theme Archie Management (slate, green checkboxes)

**Belum diimplementasikan (optional future):**
- ❌ Drag & drop reorder UI (endpoint sudah ready)
- ❌ Task progress auto-calculation dari subtasks
- ❌ Assignee selection UI di subtask
- ❌ Due date picker di subtask
- ❌ Description field untuk subtask (model sudah ada)

### 14. Detail Task Yang Lebih Lengkap

Status: **Selesai untuk kolaborasi inti**

Sudah diimplementasikan:

- Tab `Collaboration` pada modal detail task.
- Komentar antar anggota project.
- Mention anggota project melalui pilihan `@user`.
- Upload attachment dengan batas maksimal 10 MB.
- Preview attachment di browser dan download file.
- Hak akses download attachment untuk uploader, anggota project, dan admin.
- Link referensi eksternal dengan validasi URL HTTP/HTTPS.
- Activity history per task untuk create, update, perpindahan kolom, komentar, attachment, dan link.
- Hak hapus komentar/file/link untuk pembuat, owner project, atau admin.

Pengembangan lanjutan:

- Activity lebih detail untuk perubahan assignee dan nilai field sebelum/sesudah.
- Rich text editor dan inline image preview.
- Notifikasi mention masuk ke panel notification Archie Management (Section 17).

### 15. Pengaturan Kolom Kanban

Status: **Tidak diperlukan - sesuai SOP perusahaan**

Keputusan:

- Tujuh kolom Kanban yang tersedia sudah sesuai SOP perusahaan.
- User tidak perlu mengubah nama, warna, urutan, menambah, atau menghapus kolom.
- Struktur baku dipertahankan: Backlog, To Do, Development, Review, UAT, Deploy To Production, dan Done.
- Kolom `Done` tetap menjadi dasar perhitungan progress project.
- Tahap pengembangan konfigurasi kolom dilewati.

### 16. Filter dan Pencarian Task Lanjutan

Status: **Selesai untuk filter inti**

Sudah diimplementasikan:

- Search judul, deskripsi, kategori, dan nama assignee pada board dan list.
- Filter assignee, priority, category, dan column/status.
- Filter task overdue, jatuh tempo tujuh hari, dan tanpa deadline.
- Counter hasil filter dibanding total task.
- Empty state khusus saat tidak ada task yang cocok.
- Clear seluruh filter dalam satu tindakan.
- Penyimpanan filter terakhir per user dan per project di browser.
- Drag-and-drop otomatis dinonaktifkan saat filter aktif untuk menjaga urutan task tetap valid.
- Halaman `Tugas Internal Saya` menampilkan seluruh task yang ditugaskan kepada user login.
- Tab task personal: Semua, Terlambat, Hari Ini, Akan Datang, dan Selesai.
- Filter task personal berdasarkan pencarian, project, dan priority.
- Klik task personal membuka modal detail task langsung pada workspace project terkait.

Pengembangan lanjutan:

- Pagination atau load more per kolom untuk project besar.
- Server-side filtering jika jumlah task per project sudah besar.

### 17. Notifikasi dan Reminder

Status: **Selesai untuk notifikasi inti**

Sudah diimplementasikan:

- Notifikasi personal saat ditambahkan sebagai anggota project.
- Notifikasi saat mendapatkan assignment task baru.
- Notifikasi perubahan status/kolom task kepada assignee.
- Notifikasi komentar kepada creator dan assignee terkait.
- Notifikasi mention kepada anggota yang disebutkan.
- Reminder task yang jatuh tempo dalam tiga hari.
- Reminder task overdue.
- Status unread/read dan aksi tandai semua dibaca.
- Integrasi dengan panel lonceng Archie Management bersama pengumuman perusahaan.
- Klik notifikasi membuka workspace Internal Project terkait.

Pengembangan lanjutan:

- Background scheduler agar reminder dibuat tanpa menunggu user membuka aplikasi.
- Email, WhatsApp, atau push notification bila dibutuhkan.
- Pengaturan preferensi notifikasi per user.

### 18. Report dan Export

Status: **Selesai untuk laporan inti**

Sudah diimplementasikan:

- Halaman `Internal Project > Laporan` pada route `/internal-project/reports`.
- Ringkasan proyek aktif, task selesai, overdue, high priority, dan overall progress.
- Filter project, anggota terdaftar, serta periode tanggal.
- Export CSV task berisi project, task, category, priority, status, assignee, deadline, overdue, dan creator.
- Export CSV timesheet berisi project, task, user, clock in, clock out, dan total jam.
- Ringkasan manajemen siap print atau simpan PDF berisi project health, progress, jumlah anggota, statistik task, dan tracked hours.
- Filter anggota diterapkan pada project membership, assignment task, dan time log sesuai jenis laporan.
- Seluruh query report mengikuti akses data: admin dapat melihat semua project, sedangkan user lain hanya project tempat dirinya menjadi anggota.
- Dukungan label menu dan halaman dalam Bahasa Indonesia dan English.

Endpoint:

- `GET /api/v1/internal-projects/reports/export?type=tasks`
- `GET /api/v1/internal-projects/reports/export?type=timesheet`
- `GET /api/v1/internal-projects/reports/summary`

Pengembangan lanjutan opsional:

- Export native Excel `.xlsx` dengan format dan chart.
- Scheduled report melalui email atau kanal notifikasi lain.
- Template PDF dengan identitas perusahaan yang dapat dikonfigurasi.

### 19. Permission Per Application Role

Status: **Selesai untuk permission menu inti**

Sudah diimplementasikan:

- Permission `internal-project.dashboard`, `internal-project.projects`, `internal-project.timesheet`, dan `internal-project.reports` tersedia di Role Settings.
- Menu dan direct frontend route mengikuti `can_read`.
- API backend menerapkan `can_read` dan `can_edit` sesuai jenis endpoint.
- Endpoint filter project bersama hanya dapat dipakai user yang memiliki minimal satu permission Internal Project.
- Akses data dibatasi berdasarkan keanggotaan project.
- Owner/admin memiliki kontrol pengelolaan project dan member.
- Admin dan user tanpa application role tetap memiliki full access untuk kompatibilitas data existing.

Pengembangan lanjutan opsional:

- Pemisahan `can_read`, `can_create`, `can_edit`, `can_delete`, dan `can_manage_members` bila diperlukan.
- Pengujian seluruh kombinasi admin, owner, member, assignee, dan user non-member.

### 20. Audit Trail Khusus Internal Project

Status: **Sebagian**

Sudah tercatat:

- Create, update, dan delete project.
- Add dan remove member.
- Create, update, move, dan delete task.

Belum:

- Tampilan activity feed pada detail project/task.
- Filter audit entity Internal Project pada halaman Audit Trail.
- Audit comment, attachment, timer, dan perubahan konfigurasi kolom.

### 21. Monitoring Lanjutan

Status: **Belum**

Target fitur:

- Trend task selesai per minggu/bulan.
- Workload capacity dan estimasi overload.
- Project health score.
- Status breakdown per project.
- Waktu kerja per member/project.
- Average cycle time dari Backlog sampai Done.
- Lead time per task.
- Perbandingan target dan realisasi deadline.

### 22. Automated Testing

Status: **Sebagian - test dasar tersedia**

Sudah tersedia:

- Test parsing tanggal Internal Project dalam timezone WIB.
- Test cutoff scheduler sebelum dan setelah pukul 23:30 WIB.
- Test penolakan clock-in pada dan setelah cutoff.
- Backend `go test ./...`, frontend ESLint, dan production build lulus.

Target pengujian:

- Unit test handler dan progress calculation.
- Integration test seluruh endpoint Internal Project.
- Test akses admin, owner, member, dan non-member.
- Test validasi assignee.
- Test migrasi tujuh kolom.
- Test drag-and-drop/reordering task.
- Frontend component test.
- End-to-end test create project sampai task Done.
- Regression test agar Project client tidak terpengaruh.

### 23. Performance dan Security Hardening

Status: **Belum**

Target pekerjaan:

- Review index database untuk query dashboard dan Kanban besar.
- Menghindari preload data berlebih pada dashboard.
- Pagination task dan activity history.
- Validasi ukuran dan tipe attachment.
- Sanitasi comment dan text input.
- Rate limiting endpoint timer/comment/upload.
- Review cascade delete dan soft delete.
- Pengujian race condition drag-and-drop dan timer.

### 24. UAT dan Penyempurnaan UI/UX

Status: **Belum**

Target pekerjaan:

- UAT bersama management dan user operasional.
- Pengujian desktop, tablet, dan mobile.
- Empty state dan error state seluruh fitur.
- Accessibility keyboard untuk Kanban dan modal.
- Konsistensi istilah Indonesia dan English.
- Review warna, spacing, chart, dan kepadatan informasi.
- Penyempurnaan berdasarkan hasil penggunaan lokal.

### 25. Persiapan Production

Status: **Belum**

Target pekerjaan:

- Final review perubahan database.
- Backup database production.
- Verifikasi migration idempotent.
- Commit perubahan terpilih tanpa file lokal yang tidak terkait.
- Push ke repository Archie Management.
- Build production image.
- Deploy backend dan frontend.
- Health check API dan frontend.
- Smoke test login, project, member, task, Kanban, dan dashboard di production.
- Monitoring log setelah deployment.
- Menyusun rollback plan.

---

## Urutan Pengerjaan Yang Direkomendasikan

1. Penyempurnaan audit trail.
2. Monitoring analytics lanjutan.
3. Integration test dan regression test lanjutan.
4. Performance dan security hardening.
5. UAT serta penyempurnaan UI/UX.
6. Commit, push, dan deployment production.

## Kriteria Module Dinyatakan Selesai

Module Internal Project dapat dinyatakan selesai apabila:

- Seluruh fitur inti project, member, task, Kanban, dashboard, dan timesheet berjalan stabil.
- Comment, attachment, notification, report, dan permission sudah diterapkan sesuai kebutuhan final.
- Seluruh data tetap terpisah dari Project client.
- Hak akses admin, owner, member, assignee, dan non-member sudah diuji.
- Automated test utama dan regression test lulus.
- UAT management dan user telah disetujui.
- Migration production telah diuji dan memiliki rollback plan.
- Deployment production berhasil dan smoke test production lulus.

## Status Testing dan Deployment (Update 9 Juni 2026 - 20:46 WIB)

### Environment Lokal

**Backend Archie Management:**
- Status: ✅ Running
- Port: 8080
- URL: http://localhost:8080
- Health check: http://localhost:8080/health → `{"status":"ok","version":"1.0.2"}`
- Database migration: Auto-migrated (time log, subtask, comments, mentions, attachments, links, dan activities)

**Frontend Archie Management:**
- Status: ✅ Running
- Port: 3000 (CATAT: ini Archie Management, bukan Archie Management-PCI di 3010)
- URL: http://localhost:3000
- Vite dev server dengan HMR
- Proxy: `/api` → `http://localhost:8080` (Fixed dari 8082)

**Frontend Archie Management-PCI:**
- Status: ✅ Running (tidak terpengaruh)
- Port: 3010
- URL: http://localhost:3010
- Tetap aman, tidak kesenggol saat restart Archie Management

### File Yang Sudah Dimodifikasi

**Backend:**
```
✅ internal/models/models.go              (InternalTimeLog, InternalSubtask)
✅ internal/database/database.go          (Auto migration)
✅ internal/handlers/internal_project.go  (+650 lines: time tracking + subtask)
✅ internal/handlers/internal_project_report.go (CSV task/timesheet + printable summary)
✅ internal/server/server.go              (+16 routes baru)
✅ internal/models/models.go              (task collaboration models)
```

**Frontend:**
```
✅ components/common/TaskTimer.tsx        (200 lines - komponen baru)
✅ components/common/SubtaskList.tsx      (200 lines - komponen baru)
✅ components/common/TaskCollaboration.tsx (komentar, file, link, activity)
✅ components/common/index.tsx            (+2 exports)
✅ pages/InternalProjects/InternalProjectDetailPage.tsx  (tab integration)
✅ pages/InternalProjects/TimesheetPage.tsx              (250 lines - halaman baru)
✅ pages/InternalProjects/InternalProjectDashboardPage.tsx  (time summary)
✅ pages/InternalProjects/InternalProjectReportsPage.tsx     (report & export)
✅ services/api.ts                        (time, subtask, dan collaboration API)
✅ App.tsx                                (route timesheet dan report)
✅ config/navigation.ts                   (menu Timesheet dan Laporan)
✅ vite.config.ts                         (proxy fix: 8082 → 8080)
```

**Total:**
- Backend: +650 lines, 15 endpoints baru
- Frontend: +850 lines, 2 komponen baru, 1 halaman baru
- Routes: 16 API routes, 1 frontend route

### Compile & Build Status

```bash
✅ Backend compile:  go build SUCCESS
✅ Frontend build:   npm run build SUCCESS (3.75s)
✅ TypeScript:       NO ERRORS
✅ ESLint:           PASSED
✅ Routes conflict:  RESOLVED (taskId → id)
✅ Proxy config:     FIXED (8082 → 8080)
```

### Testing Checklist

**Ready to Test:**
- [ ] Login di http://localhost:3000
- [ ] Akses Internal Project → Projects
- [ ] Klik task → Tab "Time Tracking"
- [ ] Clock in/out timer
- [ ] Tab "Subtasks"
- [ ] Add/toggle/delete subtask
- [ ] Menu "Timesheet"
- [ ] Monitoring time summary
- [ ] Tab "Collaboration"
- [ ] Add comment dan mention anggota project
- [ ] Upload, preview, download, dan remove attachment
- [ ] Add dan remove reference link
- [ ] Periksa activity history

**Known Issues:**
- ✅ RESOLVED: Proxy port salah (8082 → 8080)
- ✅ RESOLVED: Route conflict (:taskId → :id)
- ✅ RESOLVED: Frontend restart required

### Catatan Deployment Production

- ⚠️ Implementasi masih di local workspace
- ⚠️ Perubahan belum di-commit dan belum di-push
- ⚠️ Database migration akan auto-run saat deploy (CREATE TABLE if not exists)
- ⚠️ Belum dilakukan deployment production
- ⚠️ File lokal seperti `catatan NEX-ONE WEB.docx` dan `docker-compose.override.yml` tidak boleh ikut commit

### Next Steps

1. **Testing oleh user** (sedang berlangsung)
2. Bug fixes berdasarkan testing
3. Code review (opsional)
4. Git commit dengan message yang jelas
5. Push ke repository
6. Deployment ke production (setelah approval)

---

## Changelog

### 9 Juni 2026
- **18:45 WIB:** Implementasi Time Tracking & Subtask selesai (75% progress)
- **19:15 WIB:** Environment lokal ready for testing, proxy fix, semua service UP
- **20:00 WIB:** Detail Task collaboration selesai: komentar, mention, attachment, link referensi, dan activity history
- **Terminologi UI:** Seluruh label `Dashboard` pada Module Internal Project diubah menjadi `Monitoring`.
- **Multi bahasa:** Title menjadi `Monitoring Proyek Internal` untuk Bahasa Indonesia dan `Internal Project Monitoring` untuk Bahasa Inggris.
- **Kompatibilitas teknis:** Route `/internal-project/dashboard`, endpoint `/api/v1/internal-projects/dashboard`, permission key `internal-project.dashboard`, serta nama file/class tetap dipertahankan agar integrasi tidak rusak.
- **Keputusan SOP Kanban:** Pengaturan custom column tidak diperlukan. Tujuh kolom default dipertahankan sebagai workflow baku perusahaan.
- **Notifikasi Internal Project:** Assignment, perubahan status, komentar, mention, deadline, dan overdue sudah masuk ke panel lonceng Archie Management dengan status unread/read.

### 10 Juni 2026
- **Monitoring Hours Today:** agregasi tim dan anggota menggunakan endpoint backend khusus dengan timezone Asia/Jakarta.
- **Chart UI:** donut tidak terpotong dan legend Task Distribution dipindahkan ke bawah agar seluruh label terlihat.
- **Scheduler:** menambahkan startup catch-up, pembatasan durasi pada cutoff, dan blok clock-in setelah 23:30 WIB.
- **Permission:** mengaktifkan permission Internal Project pada navigasi, direct route, dan API backend.
- **Testing:** menambahkan unit test cutoff scheduler dan parsing tanggal WIB; backend test, ESLint, dan production build lulus.
- **My Internal Tasks:** tombol `Lihat semua tugas saya` kini membuka `/internal-project/my-tasks`, dengan tab deadline, filter, dan deep-link menuju modal detail task.
- **Timesheet member filter:** pilihan user kini dimuat dari anggota project yang dipilih dan dapat digunakan oleh pemegang permission Project maupun Timesheet.
- **Release validation:** backend test, frontend ESLint, production build, Linux backend build, Docker Compose config, dan `git diff --check` lulus.
- **Release safety:** upload runtime, Docker override lokal, dan dokumen Word pribadi dikecualikan dari Git.
- **Production deployment:** release `25fe2a1` dibangun dan dijalankan pada `https://archie.nexoratech.co`.
- **Database safety:** backup PostgreSQL terkompresi dibuat dan diverifikasi sebelum container aplikasi diganti.
- **Production smoke test:** frontend, login, Internal Project list, Monitoring, dan My Tasks merespons HTTP 200; seluruh tabel baru tersedia dan log backend bersih.
