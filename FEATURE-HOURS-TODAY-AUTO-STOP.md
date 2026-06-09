# Feature: Hours Today Donut Chart & Auto-Stop Timer

**Date:** 10 Juni 2026
**Status:** ✅ Implemented

---

## 📊 **1. HOURS TODAY DONUT CHART**

### **Objective:**
Visualisasi jam kerja harian (hari ini) dalam bentuk donut chart, dengan range 0-24 jam.

### **Features:**
- ✅ Donut chart progress 0-24 jam
- ✅ Warna dinamis:
  - **Hijau** (0-8h): Normal workload
  - **Kuning** (8-16h): Medium workload
  - **Merah** (16-24h): High workload
- ✅ Display: `{todayHours}h of 24h` di tengah donut
- ✅ Filter behavior:
  - **Default (All members):** Total jam seluruh tim hari ini
  - **Filter user:** Jam user tersebut saja hari ini
  - **Filter project:** Jam dalam project tersebut
  - **Filter project + user:** Jam user di project tersebut

### **Implementation:**

**Frontend:** `InternalProjectDashboardPage.tsx`
- Component: Recharts PieChart dengan innerRadius/outerRadius
- Data: `[{ name: 'Worked', value: min(todayHours, 24) }, { name: 'Remaining', value: max(0, 24-todayHours) }]`
- Color logic:
  ```tsx
  todayHours >= 16 ? '#ef4444' :  // Red
  todayHours >= 8  ? '#f59e0b' :  // Amber
                     '#10b981'    // Green
  ```
- Layout: Grid 3 kolom (Task Distribution | Hours Today | Member Workload)

**Backend:** endpoint ringkasan khusus
- Menggunakan `GET /api/v1/internal-projects/time-summary`.
- Menghitung Today dan Week dalam timezone `Asia/Jakarta`.
- Default menghitung seluruh anggota pada project yang dapat diakses, bukan hanya user login.
- Filter `project_id` dan `user_id` diterapkan langsung pada query agregasi.

### **UI Specification:**
```
┌─────────────────────────────┐
│ Hours Today                 │
│ Individual daily hours      │  ← subtitle changes based on filter
├─────────────────────────────┤
│         ╭─────╮            │
│       ╱         ╲          │
│      │   8.5h   │         │  ← center text: hours
│       ╲  of 24h ╱          │  ← subtitle: max
│         ╰─────╯            │
│                             │
│  [0-8h] [8-16h] [16-24h]   │  ← legend with color bars
└─────────────────────────────┘
```

### **Business Logic:**
- Max display: 24 jam (lingkaran penuh)
- Jika > 24 jam tetap ditampilkan angka asli, tetapi donut tetap 100%
- Timer aktif (belum clock out) TIDAK dihitung dalam todayHours
- Hanya completed time logs (clock_out != NULL) yang dihitung

---

## ⏰ **2. AUTO-STOP TIMER SCHEDULER**

### **Objective:**
Mencegah fake timer / user lupa stop timer dengan auto clock-out semua timer aktif setiap hari jam 23:30 WIB.

### **Features:**
- ✅ Background scheduler berjalan setiap hari jam 23:30 WIB
- ✅ Auto clock-out semua `internal_time_logs` yang `clock_out IS NULL`
- ✅ Hitung duration otomatis: `now - clock_in`
- ✅ Log setiap eksekusi untuk monitoring
- ✅ Timezone: Asia/Jakarta (WIB = UTC+7)
- ✅ Startup catch-up menutup timer yang tertinggal saat server restart/downtime.
- ✅ Durasi timer tertinggal dibatasi sampai cutoff yang seharusnya, bukan waktu restart server.
- ✅ Clock-in baru ditolak setelah 23:30 WIB agar tidak melewati cutoff harian.

### **Implementation:**

**Backend Package:** `internal/scheduler/auto_stop_timer.go`

**Function:**
```go
StartAutoStopTimers(db *gorm.DB)
  - Infinite loop dengan sleep
  - Calculate next 23:30 WIB
  - Sleep hingga waktu tersebut
  - Execute autoStopActiveTimers()
  - Loop lagi untuk hari berikutnya

autoStopActiveTimers(db *gorm.DB)
  - Query: SELECT * FROM internal_time_logs WHERE clock_out IS NULL
  - For each active log:
    - duration = now - clock_in
    - UPDATE internal_time_logs SET clock_out = now, duration_seconds = duration WHERE id = ?
  - Log: "Auto-stop: Successfully stopped X timer(s)"
```

**Main Entry:** `cmd/api/main.go`
```go
go scheduler.StartAutoStopTimers(db)
log.Println("Auto-stop timer scheduler started (runs daily at 23:30 WIB)")
```

### **Scheduler Behavior:**
1. **Server start:** Jalankan catch-up untuk cutoff terakhir.
2. **Schedule:** Hitung kapan 23:30 WIB berikutnya.
3. **Sleep:** Tunggu hingga jadwal tersebut.
4. **Execute:** Auto clock-out seluruh timer aktif yang dimulai sebelum cutoff.
5. **Log dan repeat:** Catat hasil lalu jadwalkan hari berikutnya.

### **Edge Cases:**
- **Server restart:** Scheduler menjalankan catch-up lalu schedule ulang.
- **Timezone error:** Fallback ke UTC, log warning
- **Database error:** Log error, tidak crash, lanjut ke hari berikutnya
- **Tidak ada timer aktif:** Log "No active timers to stop"

### **Monitoring:**
Logs yang dihasilkan:
```
2026-06-09 10:00:00 - Auto-stop timer scheduler started (runs daily at 23:30 WIB)
2026-06-09 10:00:00 - Next auto-stop timers scheduled at: 2026-06-09 23:30:00 WIB (in 13h30m0s)
2026-06-09 23:30:00 - Auto-stop: Successfully stopped 5 active timer(s) at 2026-06-09 23:30:00
2026-06-09 23:30:00 - Next auto-stop timers scheduled at: 2026-06-10 23:30:00 WIB (in 24h0m0s)
```

### **Testing:**
**Manual test (dev):**
```bash
# Ubah sementara jam scheduler ke 1 menit ke depan untuk test
next := time.Date(now.Year(), now.Month(), now.Day(), now.Hour(), now.Minute()+1, 0, 0, location)

# Start backend, tunggu 1 menit, cek logs
# Cek database: internal_time_logs dengan clock_out IS NULL harus ter-update
```

**Production test:**
- Deploy dan monitor log jam 23:30 WIB
- Cek keesokan harinya apakah ada timer yang masih NULL

---

## 🗃️ **DATABASE IMPACT**

**No migration needed!**
- Menggunakan existing table: `internal_time_logs`
- Menggunakan existing columns: `clock_in`, `clock_out`, `duration_seconds`

---

## 📦 **FILES CHANGED**

### **Backend:**
```
✅ cmd/api/main.go                                      (+4 lines)
   - Import scheduler package
   - Start goroutine scheduler.StartAutoStopTimers(db)

✅ internal/scheduler/auto_stop_timer.go
   - Daily scheduler, startup catch-up, dan cutoff duration
✅ internal/handlers/internal_project.go
   - Endpoint agregasi time-summary dan batas tanggal WIB
✅ internal/middleware/permissions.go
   - Permission read/edit untuk submenu Internal Project
```

### **Frontend:**
```
✅ Frontend/src/pages/InternalProjects/InternalProjectDashboardPage.tsx  (+40 lines)
   - Add Hours Today card dengan donut chart
   - Grid layout: 3 kolom (Task Distribution | Hours Today | Member Workload)
   - Color logic berdasarkan jam kerja
   - Legend 0-8h (green), 8-16h (amber), 16-24h (red)
   - Data team/user berasal dari endpoint agregasi yang sama
```

**Total:** +116 lines, 4 files

---

## ✅ **DEPLOYMENT CHECKLIST**

### **Pre-deployment:**
- [x] Code implemented
- [x] Frontend component ready
- [x] Backend scheduler ready
- [ ] Testing di local (manual clock in/out)
- [x] Unit test perhitungan cutoff dan aturan clock-in
- [x] Unit test parsing tanggal WIB
- [ ] Integration test scheduler dengan database terisolasi
- [ ] Code review final

### **Deployment:**
- [ ] Commit changes
- [ ] Push to repository
- [ ] Deploy backend (scheduler akan auto-start)
- [ ] Deploy frontend
- [ ] Monitor logs jam 23:30 WIB pertama kali

### **Post-deployment:**
- [ ] Verify scheduler log muncul di production
- [ ] Verify timer auto-stop jam 23:30 WIB
- [ ] Monitor database: cek tidak ada timer yang tertinggal NULL setelah 23:30
- [ ] User notification (opsional): inform team tentang auto-stop policy

---

## 🔧 **CONFIGURATION**

**Timezone:** Hardcoded `Asia/Jakarta` (WIB = UTC+7)

**Schedule Time:** Hardcoded `23:30` WIB

**Max Hours Display:** Hardcoded `24` jam (lingkaran penuh)

**Future enhancement (jika perlu):**
- Config via environment variable:
  ```env
  AUTO_STOP_TIME=23:30
  AUTO_STOP_TIMEZONE=Asia/Jakarta
  MAX_HOURS_DISPLAY=24
  ```

---

## 📊 **METRICS TO MONITOR**

1. **Daily auto-stop count:** Berapa timer yang di-stop setiap hari?
   - Jika tinggi (>10): User sering lupa stop → perlu edukasi
   - Jika rendah (<3): User sudah disiplin

2. **Hours today distribution:**
   - Berapa % team kerja >16 jam/hari? (red zone)
   - Berapa % team kerja 8-16 jam/hari? (medium)
   - Berapa % team kerja <8 jam/hari? (normal)

3. **Fake timer prevention:**
   - Sebelum auto-stop: berapa % timer melewati cutoff?
   - Setelah auto-stop: harus 0%

---

## 🎯 **USER BENEFITS**

1. **Visual insight:** Manager bisa lihat beban kerja tim sekilas
2. **Fair tracking:** Tidak ada timer palsu karena lupa stop
3. **Individual awareness:** User tahu sudah berapa jam kerja hari ini
4. **Data accuracy:** Time logs lebih akurat untuk reporting

---

## ⚠️ **KNOWN LIMITATIONS**

1. **24 jam max display:**
   - Jika data agregat tim lebih dari 24 jam, angka tetap ditampilkan tetapi donut tetap 100%
   - Tidak mendukung overtime visualization (belum ada requirement)

2. **Auto-stop time fixed:**
   - Semua user di-stop jam 23:30 WIB
   - Tidak ada per-user timezone (semua pakai WIB)
   - Tidak ada whitelist untuk 24/7 operation team

3. **Scheduler restart behavior:**
   - Timer tertinggal ditutup saat startup berdasarkan cutoff terakhir.
   - Clock-in baru tidak tersedia setelah 23:30 WIB sampai pergantian hari.

4. **No notification:**
   - User tidak dapat notifikasi saat timer di-auto-stop
   - User baru tahu ketika buka aplikasi keesokan hari

---

## 🚀 **FUTURE ENHANCEMENTS**

1. **Email notification:**
   - Kirim email ke user yang timer-nya di-auto-stop
   - Summary: "Your timer for task X was auto-stopped at 23:30"

2. **Configurable schedule:**
   - Admin bisa set jam auto-stop per project
   - Support multiple timezone untuk remote team

3. **Overtime visualization:**
   - Tambah threshold berdasarkan kebijakan jam kerja perusahaan
   - Warning badge untuk jam kerja berlebih

4. **Weekly/Monthly donut:**
   - Tambah tab untuk lihat weekly hours (0-60h)
   - Tambah tab untuk lihat monthly hours (0-176h)

5. **Auto-stop whitelist:**
   - Setting untuk exclude certain users (e.g., DevOps on-call)
   - Setting untuk exclude certain projects (e.g., 24/7 monitoring)

---

## 📝 **CHANGELOG**

### 2026-06-09
- ✅ Initial implementation
- ✅ Hours Today donut chart with color coding
- ✅ Auto-stop timer scheduler (23:30 WIB daily)
- ✅ Integration dengan existing filter (project, user)
- ✅ Documentation completed
