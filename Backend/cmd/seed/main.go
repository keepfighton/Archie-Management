package main

import (
	"fmt"
	"log"
	"time"

	"github.com/cbqa/backend/internal/config"
	"github.com/cbqa/backend/internal/database"
	"github.com/cbqa/backend/internal/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func hashPassword(pw string) string {
	h, _ := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
	return string(h)
}

func ptr[T any](v T) *T { return &v }

func main() {
	cfg := config.Load()
	db, err := database.Connect(cfg)
	if err != nil {
		log.Fatalf("DB connect error: %v", err)
	}
	if err := database.Migrate(db); err != nil {
		log.Fatalf("Migration error: %v", err)
	}

	log.Println("🌱 Seeding database...")

	// ── Labels ───────────────────────────────────────────────
	labels := []models.Label{
		{Name: "IT Audit Dept", Color: "#3b82f6"},
		{Name: "Sustainability", Color: "#10b981"},
		{Name: "PCI-DSS", Color: "#f59e0b"},
		{Name: "ISO 27001", Color: "#8b5cf6"},
		{Name: "High Priority", Color: "#ef4444"},
		{Name: "Compliance", Color: "#06b6d4"},
	}
	for i := range labels {
		db.Where(models.Label{Name: labels[i].Name}).FirstOrCreate(&labels[i])
	}
	log.Printf("  ✓ %d labels", len(labels))

	// ── Users ────────────────────────────────────────────────
	adminUser := models.User{
		Name:     "Admin Archie",
		Email:    "admin@archieconsultant.com",
		Password: hashPassword("Admin123!"),
		JobTitle: "Consultant Manager",
		Phone:    "+62-21-5551234",
		Role:     "admin",
		IsActive: true,
	}
	memberUser := models.User{
		Name:     "Staff Archie",
		Email:    "staff@archieconsultant.com",
		Password: hashPassword("Member123!"),
		JobTitle: "Senior Consultant",
		Phone:    "+62-21-5555678",
		Role:     "member",
		IsActive: true,
	}
	extraUsers := []models.User{
		{Name: "Siti Rahayu", Email: "siti@archieconsultant.com", Password: hashPassword("Member123!"), JobTitle: "Consultant", Role: "member", IsActive: true},
		{Name: "Budi Santoso", Email: "budi@archieconsultant.com", Password: hashPassword("Member123!"), JobTitle: "Project Manager", Role: "member", IsActive: true},
		{Name: "Dewi Kusuma", Email: "dewi@archieconsultant.com", Password: hashPassword("Member123!"), JobTitle: "Junior Consultant", Role: "member", IsActive: true},
	}

	upsertUser := func(u *models.User) {
		var existing models.User
		if err := db.Where("email = ?", u.Email).First(&existing).Error; err != nil {
			db.Create(u)
		} else {
			u.Base = existing.Base
		}
	}
	upsertUser(&adminUser)
	upsertUser(&memberUser)
	for i := range extraUsers {
		upsertUser(&extraUsers[i])
	}
	allMembers := []*models.User{&adminUser, &memberUser, &extraUsers[0], &extraUsers[1], &extraUsers[2]}
	log.Printf("  ✓ %d users (admin@archieconsultant.com / Admin123!, staff@archieconsultant.com / Member123!)", len(allMembers))

	// ── Clients ──────────────────────────────────────────────
	clientsData := []struct {
		name, email, phone, address, clientType string
	}{
		{"PT Bank Nusantara Tbk", "contact@banknusantara.co.id", "+62-21-5001000", "Jl. Sudirman No. 1, Jakarta", "company"},
		{"PT Telekomunikasi Nusantara", "info@telkomnusantara.co.id", "+62-21-5002000", "Jl. Gatot Subroto No. 52, Jakarta", "company"},
		{"PT Asuransi Mandiri Sejahtera", "audit@ams.co.id", "+62-21-5003000", "Jl. Thamrin No. 10, Jakarta", "company"},
		{"CV Solusi Teknologi Indonesia", "it@solusitek.id", "+62-22-7001000", "Jl. Asia Afrika No. 65, Bandung", "company"},
		{"PT Energi Terbarukan Nusantara", "compliance@etn.co.id", "+62-21-5004000", "Jl. HR Rasuna Said Kav. 12, Jakarta", "company"},
		{"PT Retailindo Maju Bersama", "risk@retailindo.co.id", "+62-31-8001000", "Jl. Pemuda No. 31, Surabaya", "company"},
		{"Yayasan Pendidikan Cendekia", "admin@ypcendekia.org", "+62-21-7801000", "Jl. Kebayoran Baru No. 5, Jakarta", "company"},
		{"PT Logistik Andalan Trans", "finance@lat.co.id", "+62-24-8501000", "Jl. Siliwangi No. 21, Semarang", "company"},
		{"PT Properti Griya Utama", "legal@griyautama.co.id", "+62-21-5005000", "Jl. Kemang Raya No. 7, Jakarta", "company"},
		{"Koperasi Kredit Maju Sejahtera", "audit@kkms.coop", "+62-21-5006000", "Jl. Pahlawan No. 3, Bekasi", "company"},
	}

	clients := make([]models.Client, len(clientsData))
	for i, c := range clientsData {
		var existing models.Client
		err := db.Where("name = ?", c.name).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			clients[i] = models.Client{
				Name:     c.name,
				Type:     c.clientType,
				Email:    c.email,
				Phone:    c.phone,
				Address:  c.address,
				Currency: "IDR",
				OwnerID:  adminUser.ID,
			}
			db.Create(&clients[i])
		} else {
			clients[i] = existing
		}
	}
	log.Printf("  ✓ %d clients", len(clients))

	// ── Projects ─────────────────────────────────────────────
	now := time.Now()
	projectsData := []struct {
		title, status, desc string
		progress            int
		clientIdx           int
		daysAgo, deadlineDays int
	}{
		{"IT General Controls Audit - Bank Nusantara 2024", "open", "Audit atas IT General Controls meliputi access management, change management, dan IT operations.", 45, 0, 90, 60},
		{"ISO 27001 Gap Assessment - Telkom Nusantara", "open", "Gap assessment terhadap standar ISO 27001:2022 untuk persiapan sertifikasi.", 70, 1, 60, 30},
		{"PCI-DSS Compliance Review - AMS", "completed", "Review kesesuaian sistem pembayaran terhadap PCI-DSS v4.0.", 100, 2, 180, -30},
		{"IT Audit Infrastruktur - Solusi Teknologi", "hold", "Audit infrastruktur IT termasuk network security dan server hardening.", 20, 3, 30, 90},
		{"Cybersecurity Assessment - ETN", "open", "Penilaian keamanan siber komprehensif termasuk penetration testing scope.", 30, 4, 15, 75},
	}

	projects := make([]models.Project, len(projectsData))
	for i, p := range projectsData {
		var existing models.Project
		err := db.Where("title = ?", p.title).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			projects[i] = models.Project{
				Title:       p.title,
				ClientID:    clients[p.clientIdx].ID,
				Price:       float64(150_000_000 + i*50_000_000),
				Currency:    "IDR",
				StartDate:   models.FlexTime{Time: now.AddDate(0, 0, -p.daysAgo)},
				Deadline:    models.FlexTime{Time: now.AddDate(0, 0, p.deadlineDays)},
				Status:      p.status,
				Progress:    p.progress,
				Description: p.desc,
			}
			db.Create(&projects[i])
		} else {
			projects[i] = existing
		}
	}
	log.Printf("  ✓ %d projects", len(projects))

	// ── Tasks ────────────────────────────────────────────────
	taskStatuses := []string{"todo", "in_progress", "done", "todo", "in_progress", "done", "done", "todo", "in_progress", "expired",
		"todo", "done", "in_progress", "todo", "done", "in_progress", "todo", "done", "in_progress", "expired"}
	priorities := []string{"high", "medium", "low", "high", "medium", "high", "low", "medium", "high", "medium",
		"low", "high", "medium", "low", "high", "medium", "high", "low", "medium", "high"}

	tasksData := []struct{ title, milestone string; projectIdx int }{
		{"Kick-off meeting dan penyusunan audit plan", "Planning", 0},
		{"Risk assessment & control identification", "Planning", 0},
		{"Fieldwork: access management review", "Fieldwork", 0},
		{"Fieldwork: change management review", "Fieldwork", 0},
		{"Fieldwork: IT operations review", "Fieldwork", 0},
		{"Dokumentasi temuan audit", "Reporting", 0},
		{"Review gap ISO 27001 Annex A kontrol", "Assessment", 1},
		{"Wawancara departemen IT", "Assessment", 1},
		{"Dokumentasi current state vs. target state", "Assessment", 1},
		{"Penyusunan roadmap perbaikan", "Reporting", 1},
		{"Review kebijakan keamanan informasi", "Documentation", 1},
		{"Test PCI-DSS Req 1-3 (Network Security)", "Testing", 2},
		{"Test PCI-DSS Req 6 (Secure Systems)", "Testing", 2},
		{"Test PCI-DSS Req 8 (Authentication)", "Testing", 2},
		{"Test PCI-DSS Req 10 (Monitoring)", "Testing", 2},
		{"Review network architecture diagram", "Fieldwork", 3},
		{"Vulnerability scanning server", "Fieldwork", 3},
		{"Pentest web application", "Testing", 4},
		{"Review firewall rules dan ACL", "Fieldwork", 4},
		{"Penyusunan laporan akhir cybersecurity", "Reporting", 4},
	}

	memberIDs := []uint{adminUser.ID, memberUser.ID, extraUsers[0].ID, extraUsers[1].ID, extraUsers[2].ID}
	for i, t := range tasksData {
		var existing models.Task
		err := db.Where("title = ?", t.title).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			assignedID := memberIDs[i%len(memberIDs)]
			task := models.Task{
				Title:        t.title,
				ProjectID:    ptr(projects[t.projectIdx].ID),
				AssignedToID: ptr(assignedID),
				StartDate:    models.FlexTime{Time: now.AddDate(0, 0, -30+i)},
				Deadline:     models.FlexTime{Time: now.AddDate(0, 0, 14+i)},
				Status:       taskStatuses[i],
				Priority:     priorities[i],
				Milestone:    t.milestone,
			}
			db.Create(&task)
		}
	}
	log.Printf("  ✓ %d tasks", len(tasksData))

	// ── Leads ────────────────────────────────────────────────
	leadStatuses := []string{"new", "qualified", "discussion", "negotiation", "won", "lost",
		"new", "qualified", "discussion", "negotiation", "won", "new", "qualified", "discussion", "won"}
	leadsData := []struct{ name, contact, email, phone, source string }{
		{"PT Garuda Finansial", "Hendra Wijaya", "hendra@garudafin.co.id", "+62-21-6001000", "Referral"},
		{"PT Media Nusantara Digital", "Rina Kusumawati", "rina@mnd.co.id", "+62-21-6002000", "Website"},
		{"CV Konsultan Bisnis Prima", "Agus Setiawan", "agus@kbprima.co.id", "+62-22-6003000", "LinkedIn"},
		{"PT Farmasi Sehat Abadi", "Nurul Hidayah", "nurul@fsabadi.co.id", "+62-21-6004000", "Conference"},
		{"PT Konstruksi Nusa Jaya", "Teguh Prabowo", "teguh@nusajaya.co.id", "+62-31-6005000", "Cold Call"},
		{"Yayasan Kesehatan Masyarakat", "Fitri Andriani", "fitri@yayasankm.org", "+62-21-6006000", "Referral"},
		{"PT Transportasi Lancar Jaya", "Darmawan Eko", "darmawan@transljaya.co.id", "+62-21-6007000", "Website"},
		{"PT Tambang Mineral Prima", "Surya Dharma", "surya@tmprimand.co.id", "+62-21-6008000", "Event"},
		{"PT Pangan Nusantara", "Lestari Wulandari", "lestari@pangannusa.co.id", "+62-24-6009000", "Referral"},
		{"PT Hotel Bintang Lima Group", "Prasetyo Adi", "prasetyo@hbl.co.id", "+62-361-6010000", "Conference"},
		{"CV Jasa Konsultasi Maju", "Yuni Astuti", "yuni@jasakm.co.id", "+62-21-6011000", "LinkedIn"},
		{"PT Startup Teknologi Canggih", "Rizky Firmansyah", "rizky@stcanggih.co.id", "+62-21-6012000", "Website"},
		{"PT Ekspor Import Nusantara", "Bambang Sukirno", "bambang@einusantara.co.id", "+62-21-6013000", "Referral"},
		{"Koperasi Simpan Pinjam Makmur", "Wahyu Kurniawan", "wahyu@kspm.coop", "+62-21-6014000", "Cold Call"},
		{"PT Perkebunan Subur Makmur", "Endang Sulistyo", "endang@psbm.co.id", "+62-21-6015000", "Conference"},
	}

	for i, l := range leadsData {
		var existing models.Lead
		err := db.Where("name = ?", l.name).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			lead := models.Lead{
				Name:           l.name,
				PrimaryContact: l.contact,
				Email:          l.email,
				Phone:          l.phone,
				Source:         l.source,
				Status:         leadStatuses[i],
				OwnerID:        memberIDs[i%len(memberIDs)],
				Notes:          fmt.Sprintf("Lead dari sumber %s. Tertarik dengan layanan IT Audit dan Compliance.", l.source),
			}
			db.Create(&lead)
		}
	}
	log.Printf("  ✓ %d leads", len(leadsData))

	// ── Invoices ─────────────────────────────────────────────
	invoiceStatuses := []string{"fully_paid", "not_paid", "partially_paid", "draft", "overdue", "fully_paid", "not_paid", "partially_paid", "draft", "overdue"}
	for i := 0; i < 10; i++ {
		invNum := fmt.Sprintf("INV-2024%02d-%04d", i+1, i+1001)
		var existing models.Invoice
		err := db.Where("invoice_number = ?", invNum).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			totalAmount := float64(50_000_000 + i*25_000_000)
			taxAmount := totalAmount * 0.11
			paidAmount := 0.0
			status := invoiceStatuses[i]
			if status == "fully_paid" {
				paidAmount = totalAmount + taxAmount
			} else if status == "partially_paid" {
				paidAmount = (totalAmount + taxAmount) * 0.5
			}
			dueAmount := (totalAmount + taxAmount) - paidAmount

			inv := models.Invoice{
				InvoiceNumber:  invNum,
				ClientID:       clients[i%len(clients)].ID,
				ProjectID:      ptr(projects[i%len(projects)].ID),
				BillDate:       models.FlexTime{Time: now.AddDate(0, -i, 0)},
				DueDate:        models.FlexTime{Time: now.AddDate(0, -i+1, 0)},
				Status:         status,
				Currency:       "IDR",
				TotalAmount:    totalAmount,
				TaxAmount:      taxAmount,
				DiscountAmount: 0,
				PaidAmount:     paidAmount,
				DueAmount:      dueAmount,
				Notes:          fmt.Sprintf("Invoice untuk %s - Termin %d", projects[i%len(projects)].Title, i+1),
			}
			db.Create(&inv)

			// Add invoice items
			items := []models.InvoiceItem{
				{InvoiceID: inv.ID, Description: "Jasa IT Audit", Quantity: 1, UnitPrice: totalAmount * 0.7, Total: totalAmount * 0.7},
				{InvoiceID: inv.ID, Description: "Biaya Perjalanan", Quantity: 1, UnitPrice: totalAmount * 0.2, Total: totalAmount * 0.2},
				{InvoiceID: inv.ID, Description: "Biaya Administrasi", Quantity: 1, UnitPrice: totalAmount * 0.1, Total: totalAmount * 0.1},
			}
			for _, item := range items {
				db.Create(&item)
			}

			// Add payment for paid invoices
			if paidAmount > 0 {
				payment := models.Payment{
					InvoiceID:     inv.ID,
					Amount:        paidAmount,
					Currency:      "IDR",
					PaymentDate:   models.FlexTime{Time: now.AddDate(0, -i, 7)},
					PaymentMethod: []string{"transfer", "bank_transfer", "cash"}[i%3],
					Note:          "Pembayaran invoice " + invNum,
				}
				db.Create(&payment)
			}
		}
	}
	log.Printf("  ✓ 10 invoices")

	// ── Events ───────────────────────────────────────────────
	eventsData := []struct {
		title, desc, color, eventType string
		daysFromNow                    int
		duration                       int
	}{
		{"Kick-off Audit Bank Nusantara", "Pertemuan pembuka proyek audit", "#3b82f6", "meeting", 2, 2},
		{"Presentasi Laporan ISO 27001 Gap", "Presentasi hasil gap assessment", "#10b981", "presentation", 7, 3},
		{"Internal Team Meeting", "Koordinasi mingguan tim audit", "#f59e0b", "meeting", 3, 1},
		{"Training: ISO 27001:2022 Update", "Update pengetahuan standar terbaru", "#8b5cf6", "training", 10, 1},
		{"Deadline Laporan PCI-DSS", "Batas penyerahan laporan akhir", "#ef4444", "deadline", 14, 1},
	}

	for _, e := range eventsData {
		var existing models.Event
		err := db.Where("title = ?", e.title).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			startDate := now.AddDate(0, 0, e.daysFromNow)
			event := models.Event{
				Title:       e.title,
				Description: e.desc,
				StartDate:   models.FlexTime{Time: startDate},
				EndDate:     models.FlexTime{Time: startDate.Add(time.Duration(e.duration) * time.Hour)},
				AllDay:      false,
				Color:       e.color,
				Type:        e.eventType,
				CreatedByID: adminUser.ID,
			}
			db.Create(&event)
		}
	}
	log.Printf("  ✓ %d events", len(eventsData))

	// ── Contracts ────────────────────────────────────────────
	contractsData := []struct{ number, title, status string; clientIdx int }{
		{"CTR-2024-001", "Kontrak IT Audit Bank Nusantara 2024", "active", 0},
		{"CTR-2024-002", "Kontrak ISO 27001 Consulting Telkom", "active", 1},
		{"CTR-2023-015", "Kontrak PCI-DSS Review AMS 2023", "completed", 2},
		{"CTR-2024-003", "Kontrak Infrastruktur Audit Soltek", "draft", 3},
		{"CTR-2024-004", "Kontrak Cybersecurity Assessment ETN", "active", 4},
	}
	for _, c := range contractsData {
		var existing models.Contract
		db.Where("contract_number = ?", c.number).FirstOrCreate(&existing, models.Contract{
			ContractNumber: c.number,
			Title:          c.title,
			ClientID:       clients[c.clientIdx].ID,
			ProjectID:      ptr(projects[c.clientIdx].ID),
			ContractDate:   models.FlexTime{Time: now.AddDate(0, -3, 0)},
			ValidUntil:     models.FlexTime{Time: now.AddDate(1, 0, 0)},
			Amount:         float64(200_000_000 + c.clientIdx*100_000_000),
			Currency:       "IDR",
			Status:         c.status,
		})
	}
	log.Printf("  ✓ 5 contracts")

	// ── Items ─────────────────────────────────────────────────
	itemsData := []models.Item{
		{Title: "IT Audit (Per Engagement)", Category: "Audit Service", UnitType: "engagement", Rate: 75_000_000, Currency: "IDR"},
		{Title: "Security Assessment", Category: "Security Service", UnitType: "day", Rate: 8_500_000, Currency: "IDR"},
		{Title: "ISO 27001 Consulting", Category: "Consulting", UnitType: "month", Rate: 45_000_000, Currency: "IDR"},
		{Title: "PCI-DSS Advisory", Category: "Consulting", UnitType: "hour", Rate: 1_500_000, Currency: "IDR"},
		{Title: "Penetration Testing", Category: "Security Service", UnitType: "engagement", Rate: 35_000_000, Currency: "IDR"},
	}
	for _, item := range itemsData {
		var existing models.Item
		db.Where("title = ?", item.Title).FirstOrCreate(&existing, item)
	}
	log.Printf("  ✓ 5 items")

	// ── Expenses ─────────────────────────────────────────────
	expCats := []string{"Travel", "Software", "Office", "Training", "Meals"}
	for i := 0; i < 8; i++ {
		var existing models.Expense
		title := fmt.Sprintf("Biaya %s - Q%d 2024", expCats[i%len(expCats)], i%4+1)
		err := db.Where("title = ?", title).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			amount := float64(1_500_000 + i*500_000)
			tax := amount * 0.11
			db.Create(&models.Expense{
				Date:        models.FlexTime{Time: now.AddDate(0, -i/2, 0)},
				Category:    expCats[i%len(expCats)],
				Title:       title,
				Description: fmt.Sprintf("Pengeluaran operasional %s", expCats[i%len(expCats)]),
				Amount:      amount,
				Tax:         tax,
				SecondTax:   0,
				Total:       amount + tax,
				UserID:      memberIDs[i%len(memberIDs)],
				IsRecurring: i%3 == 0,
			})
		}
	}
	log.Printf("  ✓ 8 expenses")

	// ── Announcements ─────────────────────────────────────────
	annsData := []struct{ title, content string }{
		{"Jadwal Audit Interna Q4 2024", "Tim audit akan melaksanakan audit internal pada bulan November 2024. Semua departemen diminta mempersiapkan dokumentasi yang diperlukan."},
		{"Update Standar ISO 27001:2022", "ISO telah merilis pembaruan standar ISO 27001 versi 2022. Seluruh tim diharapkan membaca summary perubahan yang sudah di-share di folder shared."},
		{"Selamat Bergabung, Tim Baru!", "Mari sambut anggota baru tim audit kita: Dewi Kusuma sebagai Junior Auditor. Semoga bisa berkontribusi besar untuk tim kita!"},
	}
	for _, a := range annsData {
		var existing models.Announcement
		err := db.Where("title = ?", a.title).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			db.Create(&models.Announcement{
				Title:       a.title,
				Content:     a.content,
				StartDate:   models.FlexTime{Time: now.AddDate(0, 0, -7)},
				EndDate:     models.FlexTime{Time: now.AddDate(0, 1, 0)},
				CreatedByID: adminUser.ID,
			})
		}
	}
	log.Printf("  ✓ 3 announcements")

	// ── Notes ─────────────────────────────────────────────────
	notesData := []struct{ title, content, category string }{
		{"Meeting Notes - Kick-off Bank Nusantara", "Attendees: Admin CBQA, Fauzi, Tim IT Bank Nusantara\n\nKey points:\n- Scope audit: ITGC, access management, change management\n- Timeline: 3 bulan\n- PIC Client: Pak Hendra (IT Director)", "Meeting"},
		{"Temuan Sementara ISO 27001 Gap", "Gap utama yang ditemukan:\n1. Belum ada formal risk assessment process\n2. Access review tidak terjadwal secara berkala\n3. Business continuity plan belum diuji\n4. Supplier management masih lemah", "Audit"},
		{"Referensi PCI-DSS v4.0 Changes", "Perubahan signifikan di v4.0:\n- Req 6.4: Targeted risk analysis\n- Req 8.3.6: Minimum password complexity\n- Req 12.3: Targeted risk analysis formalized", "Research"},
		{"TODO Minggu Ini", "- [ ] Review fieldwork Bank Nusantara\n- [ ] Finalisasi laporan ISO gap\n- [ ] Kirim invoice INV-2024-03\n- [ ] Update status proyek di sistem", "General"},
	}
	for _, n := range notesData {
		var existing models.Note
		err := db.Where("title = ?", n.title).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			db.Create(&models.Note{
				Title:    n.title,
				Content:  n.content,
				Category: n.category,
				UserID:   adminUser.ID,
			})
		}
	}
	log.Printf("  ✓ 4 notes")

	// ── Todos ─────────────────────────────────────────────────
	todosData := []struct{ title string; done bool }{
		{"Review dokumen risk assessment Bank Nusantara", false},
		{"Siapkan checklist ISO 27001 Annex A", false},
		{"Kirim email follow-up ke client ETN", false},
		{"Update progress proyek di sistem", false},
		{"Baca update PCI-DSS v4.0 requirement 12", true},
		{"Finalisasi kontrak CTR-2024-003", false},
		{"Review fieldwork notes dari Fauzi", false},
	}
	for _, t := range todosData {
		var existing models.Todo
		err := db.Where("title = ?", t.title).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			todo := models.Todo{
				Title:  t.title,
				Done:   t.done,
				UserID: adminUser.ID,
			}
			if t.done {
				doneAt := now.AddDate(0, 0, -1)
				todo.DoneAt = &doneAt
			}
			db.Create(&todo)
		}
	}
	log.Printf("  ✓ %d todos", len(todosData))

	log.Println("\n✅ Seed selesai! Login dengan:")
	log.Println("   admin@cbqa.com  / Admin123!")
	log.Println("   fauzi@cbqa.com  / Member123!")
}
