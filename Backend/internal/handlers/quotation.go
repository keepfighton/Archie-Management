package handlers

import (
	_ "embed"
	"encoding/base64"
	"fmt"
	"html/template"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/cbqa/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type QuotationHandler struct{ db *gorm.DB }

//go:embed assets/quotations/quotations-header.png
var quotationHeaderBytes []byte

//go:embed assets/quotations/quotations-footer.png
var quotationFooterBytes []byte

func NewQuotationHandler(db *gorm.DB) *QuotationHandler { return &QuotationHandler{db: db} }

func (h *QuotationHandler) applyQuotationTotals(q *models.Quotation) {
	sub := q.SubtotalAmount
	disc := q.DiscountAmount
	if q.DiscountPct > 0 {
		disc = sub * q.DiscountPct / 100
		q.DiscountAmount = disc
	}
	afterDisc := sub - disc
	if afterDisc < 0 {
		afterDisc = 0
	}
	tax := q.TaxAmount
	if q.TaxPct > 0 {
		tax = afterDisc * q.TaxPct / 100
		q.TaxAmount = tax
	}
	q.TotalAmount = afterDisc + tax
}

func (h *QuotationHandler) recalcQuotation(id uint) {
	var quotation models.Quotation
	if err := h.db.First(&quotation, id).Error; err != nil {
		return
	}

	var subtotal float64
	h.db.Model(&models.QuotationItem{}).
		Where("quotation_id = ?", id).
		Select("COALESCE(SUM(total), 0)").
		Scan(&subtotal)

	quotation.SubtotalAmount = subtotal
	h.applyQuotationTotals(&quotation)
	h.db.Save(&quotation)
}

func (h *QuotationHandler) List(c *gin.Context) {
	var q PaginationQuery
	_ = c.ShouldBindQuery(&q)

	var quotations []models.Quotation
	var total int64
	query := h.db.Model(&models.Quotation{}).Preload("Client").Preload("Project").Preload("Lead").Preload("Items")

	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if q.Q != "" {
		query = query.Joins("LEFT JOIN clients ON clients.id = quotations.client_id").
			Where("quotations.quote_number ILIKE ? OR quotations.title ILIKE ? OR clients.name ILIKE ?", "%"+q.Q+"%", "%"+q.Q+"%", "%"+q.Q+"%")
	}

	query.Count(&total)
	query.Scopes(paginate(q)).Order("quotations.id desc").Find(&quotations)
	c.JSON(http.StatusOK, gin.H{"data": quotations, "total": total, "page": q.Page, "limit": q.Limit})
}

func (h *QuotationHandler) Create(c *gin.Context) {
	var quotation models.Quotation
	if err := c.ShouldBindJSON(&quotation); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if quotation.QuoteNumber == "" {
		quotation.QuoteNumber = fmt.Sprintf("QT-%d-%d", time.Now().Year(), time.Now().Unix()%10000)
	}
	h.applyQuotationTotals(&quotation)
	if err := h.db.Create(&quotation).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	recordAudit(h.db, c, "create", "quotation", quotation.ID, quotation.QuoteNumber)
	c.JSON(http.StatusCreated, quotation)
}

func (h *QuotationHandler) Get(c *gin.Context) {
	id, ok := mustGetID(c)
	if !ok {
		return
	}
	var quotation models.Quotation
	if err := h.db.Preload("Client").Preload("Project").Preload("Lead").Preload("Items").First(&quotation, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	c.JSON(http.StatusOK, quotation)
}

func (h *QuotationHandler) Update(c *gin.Context) {
	id, ok := mustGetID(c)
	if !ok {
		return
	}
	var quotation models.Quotation
	if err := h.db.First(&quotation, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	if err := c.ShouldBindJSON(&quotation); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.applyQuotationTotals(&quotation)
	h.db.Save(&quotation)
	recordAudit(h.db, c, "update", "quotation", quotation.ID, quotation.QuoteNumber)
	c.JSON(http.StatusOK, quotation)
}

func (h *QuotationHandler) Delete(c *gin.Context) {
	id, ok := mustGetID(c)
	if !ok {
		return
	}
	var quotation models.Quotation
	if err := h.db.First(&quotation, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	h.db.Delete(&quotation)
	recordAudit(h.db, c, "delete", "quotation", quotation.ID, quotation.QuoteNumber)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

func (h *QuotationHandler) AddItem(c *gin.Context) {
	id, ok := mustGetID(c)
	if !ok {
		return
	}
	var item models.QuotationItem
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item.QuotationID = id
	item.Total = item.Quantity * item.UnitPrice
	h.db.Create(&item)
	h.recalcQuotation(id)
	c.JSON(http.StatusCreated, item)
}

func (h *QuotationHandler) UpdateItem(c *gin.Context) {
	quotationID, ok := mustGetID(c)
	if !ok {
		return
	}
	itemID, _ := strconv.ParseUint(c.Param("itemId"), 10, 64)

	var item models.QuotationItem
	if err := h.db.Where("id = ? AND quotation_id = ?", itemID, quotationID).First(&item).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item.Total = item.Quantity * item.UnitPrice
	h.db.Save(&item)
	h.recalcQuotation(quotationID)
	c.JSON(http.StatusOK, item)
}

func (h *QuotationHandler) DeleteItem(c *gin.Context) {
	quotationID, ok := mustGetID(c)
	if !ok {
		return
	}
	itemID, _ := strconv.ParseUint(c.Param("itemId"), 10, 64)
	h.db.Where("id = ? AND quotation_id = ?", itemID, quotationID).Delete(&models.QuotationItem{})
	h.recalcQuotation(quotationID)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

func (h *QuotationHandler) Print(c *gin.Context) {
	id, ok := mustGetID(c)
	if !ok {
		return
	}
	var quotation models.Quotation
	if err := h.db.Preload("Client").Preload("Project").Preload("Items").First(&quotation, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}

	tmpl := template.Must(template.New("quotation").Funcs(template.FuncMap{
		"formatCurrency": func(amount float64, currency string) string {
			intPart := int64(amount)
			frac := int(amount*100+0.5) % 100
			s := fmt.Sprintf("%d", intPart)
			n := len(s)
			result := ""
			for i, ch := range s {
				if i > 0 && (n-i)%3 == 0 {
					result += "."
				}
				result += string(ch)
			}
			return fmt.Sprintf("%s %s,%02d", currency, result, frac)
		},
		"formatDate": func(t models.FlexTime) string {
			if t.IsZero() {
				return "-"
			}
			return t.Format("02 January 2006")
		},
		"formatRp": func(amount float64) string {
			s := fmt.Sprintf("%.0f", amount)
			n := len(s)
			result := ""
			for i, c := range s {
				if i > 0 && (n-i)%3 == 0 {
					result += "."
				}
				result += string(c)
			}
			return "Rp " + result + ",-"
		},
		"inc": func(i int) int { return i + 1 },
		"sub": func(a, b float64) float64 { return a - b },
		"terbilang": func(n float64) string {
			x := int64(n)
			if x == 0 {
				return "Nol Rupiah"
			}
			satuan := []string{"", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan",
				"Sepuluh", "Sebelas", "Dua Belas", "Tiga Belas", "Empat Belas", "Lima Belas", "Enam Belas",
				"Tujuh Belas", "Delapan Belas", "Sembilan Belas"}
			tens := []string{"", "", "Dua Puluh", "Tiga Puluh", "Empat Puluh", "Lima Puluh",
				"Enam Puluh", "Tujuh Puluh", "Delapan Puluh", "Sembilan Puluh"}
			var w func(int64) string
			w = func(v int64) string {
				if v == 0 {
					return ""
				}
				if v < 20 {
					return satuan[v]
				}
				if v < 100 {
					s := tens[v/10]
					if v%10 != 0 {
						s += " " + satuan[v%10]
					}
					return s
				}
				if v < 200 {
					s := "Seratus"
					if v%100 != 0 {
						s += " " + w(v%100)
					}
					return s
				}
				if v < 1000 {
					s := satuan[v/100] + " Ratus"
					if v%100 != 0 {
						s += " " + w(v%100)
					}
					return s
				}
				if v < 2000 {
					s := "Seribu"
					if v%1000 != 0 {
						s += " " + w(v%1000)
					}
					return s
				}
				if v < 1_000_000 {
					s := w(v/1000) + " Ribu"
					if v%1000 != 0 {
						s += " " + w(v%1000)
					}
					return s
				}
				if v < 1_000_000_000 {
					s := w(v/1_000_000) + " Juta"
					if v%1_000_000 != 0 {
						s += " " + w(v%1_000_000)
					}
					return s
				}
				if v < 1_000_000_000_000 {
					s := w(v/1_000_000_000) + " Miliar"
					if v%1_000_000_000 != 0 {
						s += " " + w(v%1_000_000_000)
					}
					return s
				}
				s := w(v/1_000_000_000_000) + " Triliun"
				if v%1_000_000_000_000 != 0 {
					s += " " + w(v%1_000_000_000_000)
				}
				return s
			}
			return w(x) + " Rupiah"
		},
		"nl2li": func(s string) template.HTML {
			result := ""
			for _, line := range strings.Split(s, "\n") {
				line = strings.TrimSpace(line)
				if line != "" {
					result += "<li>" + template.HTMLEscapeString(line) + "</li>"
				}
			}
			return template.HTML(result)
		},
	}).Parse(quotationPrintTemplate))

	c.Header("Content-Type", "text/html; charset=utf-8")
	data := struct {
		models.Quotation
		PrintedAt    string
		DownloadMode bool
		HeaderBase64 string
		FooterBase64 string
	}{
		Quotation:    quotation,
		PrintedAt:    time.Now().Format("02 January 2006 15:04"),
		DownloadMode: c.Query("download") == "1",
		HeaderBase64: base64.StdEncoding.EncodeToString(quotationHeaderBytes),
		FooterBase64: base64.StdEncoding.EncodeToString(quotationFooterBytes),
	}
	_ = tmpl.Execute(c.Writer, data)
}

func (h *QuotationHandler) resolveClientID(quotation *models.Quotation) uint {
	if quotation.ClientID != nil && *quotation.ClientID > 0 {
		return *quotation.ClientID
	}
	if quotation.LeadID != nil {
		var lead models.Lead
		if err := h.db.First(&lead, *quotation.LeadID).Error; err == nil && lead.ConvertedClientID != nil {
			return *lead.ConvertedClientID
		}
	}
	return 0
}

func (h *QuotationHandler) ConvertToInvoice(c *gin.Context) {
	id, ok := mustGetID(c)
	if !ok {
		return
	}

	var quotation models.Quotation
	if err := h.db.Preload("Items").First(&quotation, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	clientID := h.resolveClientID(&quotation)
	if clientID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Lead belum dikonversi ke Client"})
		return
	}
	var payload struct {
		InvoiceNumber  string          `json:"invoice_number"`
		BillDate       models.FlexTime `json:"bill_date"`
		DueDate        models.FlexTime `json:"due_date"`
		Status         string          `json:"status"`
		SubtotalAmount float64         `json:"subtotal_amount"`
		TaxAmount      float64         `json:"tax_amount"`
		DiscountAmount float64         `json:"discount_amount"`
		TotalAmount    float64         `json:"total_amount"`
		PaidAmount     float64         `json:"paid_amount"`
		DueAmount      float64         `json:"due_amount"`
		Notes          string          `json:"notes"`
	}
	_ = c.ShouldBindJSON(&payload)

	invoice := models.Invoice{
		InvoiceNumber:  fmt.Sprintf("INV-%d-%d", time.Now().Year(), time.Now().Unix()%10000),
		ClientID:       clientID,
		ProjectID:      quotation.ProjectID,
		BillDate:       quotation.IssueDate,
		DueDate:        quotation.ValidUntil,
		Status:         "not_paid",
		Currency:       quotation.Currency,
		SubtotalAmount: quotation.SubtotalAmount,
		TaxAmount:      quotation.TaxAmount,
		DiscountAmount: quotation.DiscountAmount,
		TotalAmount:    quotation.TotalAmount,
		DueAmount:      quotation.TotalAmount,
		Notes:          quotation.Notes,
	}
	if payload.InvoiceNumber != "" {
		invoice.InvoiceNumber = payload.InvoiceNumber
		invoice.BillDate = payload.BillDate
		invoice.DueDate = payload.DueDate
		invoice.Status = payload.Status
		invoice.SubtotalAmount = payload.SubtotalAmount
		invoice.TaxAmount = payload.TaxAmount
		invoice.DiscountAmount = payload.DiscountAmount
		invoice.TotalAmount = payload.TotalAmount
		invoice.PaidAmount = payload.PaidAmount
		invoice.DueAmount = payload.DueAmount
		invoice.Notes = payload.Notes
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&invoice).Error; err != nil {
			return err
		}

		for _, item := range quotation.Items {
			invoiceItem := models.InvoiceItem{
				InvoiceID:   invoice.ID,
				Description: item.Description,
				Quantity:    item.Quantity,
				UnitPrice:   item.UnitPrice,
				Total:       item.Total,
			}
			if err := tx.Create(&invoiceItem).Error; err != nil {
				return err
			}
		}

		quotation.Status = "converted"
		if err := tx.Save(&quotation).Error; err != nil {
			return err
		}

		recordAudit(tx, c, "convert", "quotation", quotation.ID, quotation.QuoteNumber+" -> "+invoice.InvoiceNumber)
		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Converted to invoice", "invoice_id": invoice.ID})
}

func (h *QuotationHandler) ConvertToOrder(c *gin.Context) {
	id, ok := mustGetID(c)
	if !ok {
		return
	}

	var quotation models.Quotation
	if err := h.db.First(&quotation, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	clientID := h.resolveClientID(&quotation)
	if clientID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Lead belum dikonversi ke Client"})
		return
	}

	order := models.Order{
		OrderNumber: fmt.Sprintf("ORD-%d-%d", time.Now().Year(), time.Now().Unix()%10000),
		ClientID:    clientID,
		ProjectID:   quotation.ProjectID,
		OrderDate:   quotation.IssueDate,
		Amount:      quotation.TotalAmount,
		Currency:    quotation.Currency,
		Status:      "pending",
	}
	if err := h.db.Create(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	quotation.Status = "converted"
	h.db.Save(&quotation)
	recordAudit(h.db, c, "convert", "quotation", quotation.ID, quotation.QuoteNumber+" -> "+order.OrderNumber)
	c.JSON(http.StatusOK, gin.H{"message": "Converted to order", "order_id": order.ID})
}

func (h *QuotationHandler) ConvertToContract(c *gin.Context) {
	id, ok := mustGetID(c)
	if !ok {
		return
	}

	var quotation models.Quotation
	if err := h.db.First(&quotation, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	clientID := h.resolveClientID(&quotation)
	if clientID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Lead belum dikonversi ke Client"})
		return
	}

	contract := models.Contract{
		ContractNumber: fmt.Sprintf("CTR-%d-%d", time.Now().Year(), time.Now().Unix()%10000),
		Title:          quotation.Title,
		ClientID:       clientID,
		ProjectID:      quotation.ProjectID,
		ContractDate:   quotation.IssueDate,
		ValidUntil:     quotation.ValidUntil,
		Amount:         quotation.TotalAmount,
		Currency:       quotation.Currency,
		Status:         "draft",
	}
	if err := h.db.Create(&contract).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	quotation.Status = "converted"
	h.db.Save(&quotation)
	recordAudit(h.db, c, "convert", "quotation", quotation.ID, quotation.QuoteNumber+" -> "+contract.ContractNumber)
	c.JSON(http.StatusOK, gin.H{"message": "Converted to contract", "contract_id": contract.ID})
}

const quotationPrintTemplate = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Quotation {{.QuoteNumber}}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:100%;}
body{font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.35;color:#000;background:#fff;padding:42mm 24px 44mm;}
body *{font-family:inherit;color:inherit;}
strong,b{font-weight:700;}
html,body,*{
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}
@media print{
  @page{size:A4;margin:0;}
  body{padding:42mm 15mm 44mm;}
  .no-print{display:none!important;}
  .page-break{page-break-before:always;break-before:page;}
}
.print-header{position:fixed;left:0;right:0;top:0;z-index:2;pointer-events:none;}
.print-header img{width:100%;display:block;margin:0;}
.header{display:flex;justify-content:flex-end;align-items:flex-start;margin-bottom:14px;}
.doc-heading{text-align:right;}
.doc-heading h1{font-size:12px;font-weight:700;line-height:1.2;}
.doc-heading p{font-size:12px;margin-top:2px;line-height:1.2;}
.section-label{font-size:12px;font-style:italic;font-weight:400;letter-spacing:0;margin:12px 0 5px;}
.detail-grid{display:grid;grid-template-columns:1fr 1fr;column-gap:28px;}
.detail-left,.detail-right{padding:8px 0;}
.detail-right{border-left:none;}
 .detail-row{display:flex;gap:10px;margin-bottom:3px;font-size:12px;line-height:1.35;}
.dl{min-width:92px;font-weight:700;}
.dv{flex:1;}
table{width:100%;border-collapse:collapse;font-size:12px;line-height:1.3;}
table th{background:#fff;padding:7px 8px;text-align:center;border:1px solid #b8b8b8;font-size:12px;font-weight:700;}
table th.tl{text-align:left;}
table td{padding:6px 8px;border:1px solid #b8b8b8;vertical-align:top;font-size:12px;}
table td.tc{text-align:center;}
table td.tr{text-align:right;}
.th-sub{display:block;font-weight:400;font-size:12px;line-height:1.1;}
.scope-table thead th{
  background:#1a3c7a;
  color:#fff;
  border-color:#1a3c7a;
}
.scope-table .th-sub{
  color:rgba(255,255,255,.88);
}
.terb-row td{background:#f5f5f5;font-style:italic;font-size:12px;border-top:1px solid #b8b8b8;}
.bot{display:flex;justify-content:flex-end;margin-top:10px;margin-bottom:6px;}
.tot-tbl{
  border-collapse:separate;
  border-spacing:0;
  font-size:12px;
  min-width:320px;
  background:#fff;
  border:1px solid #c9d8f0;
  border-radius:10px;
  overflow:hidden;
  box-shadow:0 8px 24px rgba(26,60,122,.08);
}
.tot-tbl td{padding:6px 12px;font-size:12px;background:#fff;}
.tot-tbl td:last-child{text-align:right;}
.tot-tbl .lbl{font-size:12px;}
.tot-tbl .emph{font-weight:600;}
.grand td{font-weight:700;font-size:12px;background:#1a3c7a;color:#fff;padding:8px 12px;}
.grand td:last-child{color:#fff;}
.terb-label{font-weight:600;font-size:12px;}
.terb-value{font-style:italic;font-size:12px;text-align:right;}
.keter{
  margin-top:10px;
  padding:10px 12px;
  font-size:12px;
  line-height:1.45;
  border:1px solid #dbe7f7;
  border-radius:10px;
  background:#f8fbff;
}
.sig-sec{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:28px;
  margin-top:18px;
}
.sig-sec > div,
.tc-sign > div{
  padding-top:8px;
  border-top:2px solid #1a3c7a;
}
.sig-at{font-size:12px;margin-bottom:2px;}
.sig-lbl{font-weight:700;margin-bottom:3px;font-size:12px;}
.sig-line{height:56px;border-bottom:1px solid #1a3c7a;margin:6px 0;}
.sig-name{font-weight:700;font-size:12px;}
.sig-ttl{font-size:12px;}
.tc-hdr{font-size:12px;font-weight:700;margin-bottom:12px;text-align:center;border-bottom:1px solid #b8b8b8;padding-bottom:7px;}
.tc-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 22px;font-size:12px;line-height:1.45;}
.tc-pasal{margin-bottom:8px;}
.tc-pasal strong{display:block;margin-bottom:2px;font-size:12px;}
.tc-sign{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:28px;
  margin-top:24px;
  font-size:12px;
}
.tc-at{font-size:12px;margin-bottom:2px;}
.tc-name{font-weight:700;font-size:12px;}
.tc-ttl{font-size:12px;}
.print-footer{position:fixed;left:0;right:0;bottom:0;z-index:2;pointer-events:none;}
.print-footer img{display:block;width:100%;margin:0;}
</style>
</head>
<body>

<!-- HEADER -->
<div class="print-header">
  <img src="data:image/png;base64,{{.HeaderBase64}}" alt="Archie quotation header">
</div>
<div class="header">
  <div class="doc-heading">
    <h1>Quotation{{if gt .Revision 0}} (Revision {{.Revision}}){{end}}</h1>
    <p>{{.QuoteNumber}}</p>

  </div>
</div>

<!-- CUSTOMER DETAILS -->
<div class="section-label">Customer Details</div>
<div class="detail-grid">
  <div class="detail-left">
    {{if .Client}}<div class="detail-row"><span class="dl">Nama</span><span class="dv">{{.Client.Name}}</span></div>
    <div class="detail-row"><span class="dl">Alamat</span><span class="dv">{{.Client.Address}}</span></div>{{end}}
    <div class="detail-row"><span class="dl">PIC</span><span class="dv">{{if .PIC}}{{.PIC}}{{else}}-{{end}}</span></div>
    <div class="detail-row"><span class="dl">Kontak</span><span class="dv">{{if .ContactPhone}}{{.ContactPhone}}{{else if .Client}}{{.Client.Phone}}{{else}}-{{end}}</span></div>
    <div class="detail-row"><span class="dl">Email</span><span class="dv">{{if .Client}}{{.Client.Email}}{{else}}-{{end}}</span></div>
  </div>
  <div class="detail-right">
    <div class="detail-row"><span class="dl">No Kontrak</span><span class="dv">{{if .ContractNo}}{{.ContractNo}}{{else}}-{{end}}</span></div>
    <div class="detail-row"><span class="dl">Tanggal Order</span><span class="dv">{{formatDate .IssueDate}}</span></div>
    <div class="detail-row"><span class="dl">Masa Berlaku</span><span class="dv">{{if .MasaBerlaku}}{{.MasaBerlaku}}{{else}}s/d {{formatDate .ValidUntil}}{{end}}</span></div>
    {{if .Project}}<div class="detail-row"><span class="dl">Project</span><span class="dv">{{.Project.Title}}</span></div>{{end}}
  </div>
</div>

<!-- PRODUCT SCOPE -->
<div class="section-label">PRODUCT SCOPE</div>
<table class="scope-table">
  <thead>
    <tr>
      <th style="width:4%">NO</th>
      <th class="tl" style="width:40%">PRODUCT</th>
      <th style="width:8%">QTY</th>
      <th style="width:12%">DURATION<br><span class="th-sub">(month)</span></th>
      <th style="width:18%">HARGA SATUAN<br><span class="th-sub">({{.Currency}})</span></th>
      <th style="width:18%">JUMLAH<br><span class="th-sub">({{.Currency}})</span></th>
    </tr>
  </thead>
  <tbody>
    {{range $i,$item := .Items}}
    <tr>
      <td class="tc">{{inc $i}}</td>
      <td>{{$item.Description}}</td>
      <td class="tc">{{printf "%.0f" $item.Quantity}}</td>
      <td class="tc">{{if $item.Duration}}{{$item.Duration}}{{else}}-{{end}}</td>
      <td class="tr">{{formatRp $item.UnitPrice}}</td>
      <td class="tr">{{formatRp $item.Total}}</td>
    </tr>
    {{end}}
  </tbody>
</table>

<!-- TOTALS -->
<div class="bot">
  <table class="tot-tbl">
    <tr><td class="lbl">Subtotal</td><td>{{formatRp .SubtotalAmount}}</td></tr>
    {{if .DiscountAmount}}<tr><td class="lbl">Diskon{{if .DiscountPct}} ({{printf "%.0f" .DiscountPct}}%){{end}}</td><td>{{formatRp .DiscountAmount}}</td></tr>{{end}}
    {{if .DiscountAmount}}<tr><td class="lbl emph">Total Setelah Diskon</td><td class="emph">{{formatRp (sub .SubtotalAmount .DiscountAmount)}}</td></tr>{{end}}
    {{if .TaxAmount}}<tr><td class="lbl">PPN {{if .TaxPct}}{{printf "%.0f" .TaxPct}}%{{else}}10%{{end}}</td><td>{{formatRp .TaxAmount}}</td></tr>{{end}}
    <tr class="grand"><td>GRAND TOTAL</td><td>{{formatRp .TotalAmount}}</td></tr>
    <tr><td class="terb-label">Terbilang</td><td class="terb-value">{{terbilang .TotalAmount}}</td></tr>
  </table>
</div>

{{if .ScopeSummary}}
<!-- SCOPE SUMMARY -->
<div class="section-label">SCOPE OF WORK</div>
<div class="keter" style="margin-bottom:10px;">
  <ul style="margin:4px 0 0 16px;padding:0;line-height:1.8;">{{nl2li .ScopeSummary}}</ul>
</div>
{{end}}

{{if .PaymentTerms}}<div class="keter"><strong>Payment Terms:</strong> {{.PaymentTerms}}</div>{{end}}
{{if .Notes}}<div class="keter"><strong>Keterangan:</strong><br>{{.Notes}}</div>{{end}}
{{if .AcceptanceNotes}}<div class="keter"><strong>Acceptance:</strong> {{.AcceptanceNotes}}</div>{{end}}

<!-- SIGNATURES -->
<div class="sig-sec">
  <div>
    <div class="sig-at">{{.PrintedAt}}</div>
    <div class="sig-lbl">Dibuat oleh,</div>
    <div class="sig-line"></div>
    <div class="sig-name">{{if .PreparedBy}}{{.PreparedBy}}{{else}}-{{end}}</div>
    <div class="sig-ttl">{{if .PreparedByTitle}}{{.PreparedByTitle}}{{else}}Authorized Signatory{{end}}</div>
  </div>
  <div>
    <div class="sig-at">{{.PrintedAt}}</div>
    <div class="sig-lbl">Disetujui oleh,</div>
    <div class="sig-line"></div>
    <div class="sig-name">{{if .ApprovedBy}}{{.ApprovedBy}}{{else}}-{{end}}</div>
    <div class="sig-ttl">{{if .ApprovedByTitle}}{{.ApprovedByTitle}}{{else}}Director{{end}}</div>
  </div>
</div>

<!-- PAGE 2: TERMS & CONDITIONS -->
<div class="page-break">
<div class="header">
  <div class="doc-heading">
    <h1>Quotation{{if gt .Revision 0}} (Revision {{.Revision}}){{end}}</h1>
    <p>{{.QuoteNumber}}</p>
  </div>
</div>
<div class="tc-hdr">TERMS &amp; CONDITIONS</div>
<div class="tc-grid">

<div class="tc-pasal"><strong>Pasal 1: Definisi</strong>
Sistem adalah semua produk, aplikasi, dan solusi digital untuk mengotomasi sistem pelaporan dan administrasi yang dimiliki oleh Penyedia. Customer Support adalah jasa yang diberikan kepada Pihak Kedua berupa tindakan perbaikan sistem, saran, atau penggunaan sistem, dan juga pemberitahuan apabila ada pembaruan pada sistem. Pengguna Internal adalah karyawan Pihak Kedua yang alamat emailnya terdaftar pada sistem Penyedia.</div>

<div class="tc-pasal"><strong>Pasal 2: Maksud dan Tujuan</strong>
1. Maksud Perjanjian adalah untuk mengikat penggunaan sistem oleh Pihak Kedua selama Perjanjian berlaku. 2. Tujuannya adalah agar Penyedia menjamin sistem dapat digunakan Pihak Kedua sesuai dengan fungsinya, dan Pihak Kedua memberikan kompensasi biaya yang sesuai kepada Penyedia.</div>

<div class="tc-pasal"><strong>Pasal 3: Ruang Lingkup</strong>
1. Penyedia sepakat untuk memberikan izin penggunaan sistem kepada Pihak Kedua, dan Pihak Kedua sepakat untuk menggunakan sistem Penyedia hanya pada lingkungan internal sesuai jumlah pengguna pada penawaran. 2. Atas pemberian izin, Pihak Kedua wajib membayar biaya mencakup biaya lisensi dan biaya tahunan. 3. Atas penambahan pengguna, Pihak Kedua wajib membayar tambahan secara pro rata.</div>

<div class="tc-pasal"><strong>Pasal 4: Hak dan Kewajiban Para Pihak</strong>
1.1 Penyedia berhak mendapat pembayaran biaya lisensi dan biaya tahunan dari Pihak Kedua. 1.2 Penyedia berkewajiban memberikan izin penggunaan sistem kepada Pihak Kedua selama yang ditentukan pada penawaran. 1.3 Penyedia berkewajiban menyediakan sistem sesuai jumlah pengguna. 1.4 Penyedia berkewajiban memberikan Customer Support perihal penggunaan sistem. 2.1 Pihak Kedua berhak untuk menggunakan sistem Penyedia pada lingkungan internal sesuai dengan jumlah pengguna. 2.2 Pihak Kedua berhak untuk mendapatkan Customer Support.</div>

<div class="tc-pasal"><strong>Pasal 5: Jangka Waktu</strong>
1. Perjanjian ini berlaku sejak Perjanjian ini ditandatangani dan secara otomatis akan berlaku untuk periode dan jangka waktu 1 (satu) tahun berikutnya sepanjang tidak ada permintaan tertulis untuk pengakhiran penggunaan sistem oleh Pihak Kedua. 2. Jangka waktu penggunaan berlaku terhitung sejak tanggal aktif penggunaan oleh Pihak Kedua hingga saat Perjanjian ini berakhir.</div>

<div class="tc-pasal"><strong>Pasal 6: Berakhirnya Perjanjian</strong>
Perjanjian ini berakhir apabila: 1. Jika salah satu Pihak melanggar isi Perjanjian ini dan/atau terlambat pelanggaran hukum yang berlaku untuk salah satu Pihak. 2. Berakhirnya atau diakhirinya Perjanjian ini tidak menghapuskan tanggung jawab masing-masing pihak dari pelaksanaan Perjanjian ini. 3. Apabila Perjanjian diakhiri karena kelalaian atau kesengajaan yang dilakukan oleh Penyedia maka jumlah pembayaran yang telah dilakukan oleh Pihak Kedua kepada Penyedia harus dikembalikan dan karenanya menjadi hak sepenuhnya Penyedia.</div>

<div class="tc-pasal"><strong>Pasal 7: Biaya</strong>
Pihak Kedua berkewajiban untuk membayar semua biaya yang tertera pada penawaran yang sudah disetujui oleh pihak yang berwenang mewakili Pihak Kedua dengan menandatangani penawaran tersebut. Pembayaran dilakukan setelah selambat-lambatnya 7 (tujuh) hari setelah tagihan dikirimkan oleh Penyedia ke Pihak Kedua. Keterlambatan pembayaran oleh Pihak Kedua kepada Penyedia, keterlambatan yang diperkenankan adalah jangka waktu 7 (tujuh) hari sejak tanggal yang ditetapkan pada Pasal 7 ayat 2 Perjanjian ini maka akan menjadi tanggung jawab Pihak Kedua dan Pihak Kedua setuju untuk memberikan kompensasi keterlambatan sebesar 0,1% (nol koma satu persen) per hari dari nilai tagihan yang belum dibayarkan.</div>

<div class="tc-pasal"><strong>Pasal 8: Etika</strong>
Para Pihak setuju untuk saling menjaga kerahasiaan data, reputasi, nama baik, citra dan kelancaran informasi ataupun source program yang digunakan dalam sistem agar dapat berlangsung secara terus menerus dengan baik, walaupun kerjasama antara Para Pihak tidak lagi diteruskan.</div>

<div class="tc-pasal"><strong>Pasal 9: Keadaan Memaksa (Force Majeure)</strong>
Para Pihak dibebaskan dari segala sanksi atau tanggungjawab yang disebabkan keadaan/kejadian atau hal yang terjadi di luar kekuasaan wajar dari Penyedia maupun Pihak Kedua yang bersifat Force Majeure. Dalam hal timbul keadaan memaksa (Force Majeure), salah satu Pihak wajib memberitahukan kepada Pihak lainnya secara tertulis disertai dengan bukti-bukti yang cukup kuat selambat-lambatnya dalam waktu 3x24 jam.</div>

<div class="tc-pasal"><strong>Pasal 10: Pengakhiran Karena Force Majeure</strong>
Bilamana keadaan memaksa (Force Majeure) diterima oleh Pihak yang mendapat pemberitahuan, maka perlu diadakan lagi negosiasi untuk menyesuaikan kelangsungan Perjanjian sesuai dengan ketentuan yang ada tanpa merugikan kedua Para Pihak. Perjanjian ini tetap berlaku sesuai dengan ketentuan-ketentuan dalam Perjanjian ini.</div>

<div class="tc-pasal"><strong>Pasal 11: Perselisihan</strong>
1. Perjanjian ini tunduk pada Peraturan Perundang-undangan yang berlaku di wilayah Republik Indonesia. 2. Para Pihak harus berusaha mencari jalan untuk menyelesaikan masalah yang timbul terkait dengan penafsiran dan/atau pelaksanaan Perjanjian secara baik-baik (Musyawarah). Apabila penyelesaian melalui musyawarah tidak berhasil, maka Para Pihak sepakat untuk memilih tempat kedudukan hukum yang tetap dan tidak berubah di Kantor Panitera Pengadilan Negeri Jakarta Selatan.</div>

<div class="tc-pasal"><strong>Pasal 12: Pernyataan dan Jaminan</strong>
Para Pihak menyatakan dan menjamin bahwa: Perusahaan merupakan perusahaan sah, dan dijalankan dalam keadaan baik berdasarkan hukum Republik Indonesia. Terhadap Para Pihak saat ini tidak terdapat tindakan material, sengketa, gugatan, proses pengadilan, arbitrasi, pemeriksaan dan atau proses lainnya di hadapan hukum atau pengadilan atau pemerintah yang dapat mempengaruhi kemampuan pihak dalam melaksanakan kewajiban-kewajibannya berdasarkan Perjanjian ini.</div>

<div class="tc-pasal"><strong>Pasal 13: Lain-lain</strong>
Hal-hal yang belum cukup diatur dalam Perjanjian ini, namun Para Pihak memandang perlu untuk mengaturnya, maka akan dibuatkan adendum yang merupakan bagian tidak terpisahkan dari Perjanjian ini. Demikianlah Perjanjian ini dibuat dan Pihak Kedua menyatakan menyetujui Perjanjian ini secara keseluruhan tanpa pengecualian.</div>

</div>

<div class="tc-sign">
  <div>
    <div class="tc-at">{{.PrintedAt}}</div>
    <div class="sig-lbl">Dibuat oleh,</div>
    <div class="sig-line"></div>
    <div class="tc-name">{{if .PreparedBy}}{{.PreparedBy}}{{else}}-{{end}}</div>
    <div class="tc-ttl">{{if .PreparedByTitle}}{{.PreparedByTitle}}{{else}}Authorized Signatory{{end}}</div>
  </div>
  <div>
    <div class="tc-at">{{.PrintedAt}}</div>
    <div class="sig-lbl">Disetujui oleh,</div>
    <div class="sig-line"></div>
    <div class="tc-name">{{if .ApprovedBy}}{{.ApprovedBy}}{{else}}-{{end}}</div>
    <div class="tc-ttl">{{if .ApprovedByTitle}}{{.ApprovedByTitle}}{{else}}Director{{end}}</div>
  </div>
</div>
</div>

<div class="print-footer">
  <img src="data:image/png;base64,{{.FooterBase64}}" alt="Archie quotation footer">
</div>

{{if .DownloadMode}}
<div class="no-print" style="position:fixed;bottom:24px;right:24px;z-index:999;">
  <button onclick="window.print()" style="background:#1a3c7a;color:#fff;border:none;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.2);">
    ⬇ Download / Cetak PDF
  </button>
</div>
{{else}}
<script>window.onload=function(){window.print()}</script>
{{end}}
</body>
</html>`
