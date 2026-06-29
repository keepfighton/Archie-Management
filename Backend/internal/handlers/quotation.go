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
	disc := 0.0
	if q.DiscountPct > 0 {
		disc = sub * q.DiscountPct / 100
	}
	q.DiscountAmount = disc
	afterDisc := sub - disc
	if afterDisc < 0 {
		afterDisc = 0
	}
	tax := 0.0
	if q.TaxPct > 0 {
		tax = afterDisc * q.TaxPct / 100
	}
	taxType := normalizeTaxType(q.TaxType)
	switch taxType {
	case "pph":
		q.TaxAmount = tax
		q.TotalAmount = afterDisc - tax
	case "none":
		q.TaxAmount = 0
		q.TotalAmount = afterDisc
	default:
		q.TaxAmount = tax
		q.TotalAmount = afterDisc + tax
	}
	if q.TotalAmount < 0 {
		q.TotalAmount = 0
	}
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
		"taxLabel":  taxLabel,
		"taxPrefix": taxPrefix,
		"inc":       func(i int) int { return i + 1 },
		"sub":       func(a, b float64) float64 { return a - b },
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
		TaxType        string          `json:"tax_type"`
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
		TaxType:        quotation.TaxType,
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
		if payload.TaxType != "" {
			invoice.TaxType = payload.TaxType
		}
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
body{font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.35;color:#000;background:#fff;padding:42mm 24px 72mm;}
body *{font-family:inherit;color:inherit;}
strong,b{font-weight:700;}
html,body,*{
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}
@media print{
  @page{size:A4;margin:0;}
  body{padding:42mm 15mm 72mm;}
  .no-print{display:none!important;}
  .page-break{page-break-before:always;break-before:page;}
}
.terms-page{padding-top:44mm;}
.terms-page .header{margin-bottom:10px;}
.terms-page .tc-hdr{margin-top:2px;}
.tc-pasal{break-inside:avoid;page-break-inside:avoid;}
.print-header{position:fixed;left:0;right:0;top:0;z-index:2;pointer-events:none;}
.print-header img{width:100%;display:block;margin:0;}
.header{display:flex;justify-content:center;align-items:flex-start;margin-bottom:14px;}
.doc-heading{text-align:center;width:100%;}
.doc-heading h1{font-size:14px;font-weight:700;line-height:1.2;letter-spacing:.3px;text-transform:uppercase;}
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
  margin-bottom:10mm;
  break-inside:avoid;
  page-break-inside:avoid;
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
    <h1>Quotations{{if gt .Revision 0}} (Revision {{.Revision}}){{end}}</h1>
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
    {{if .TaxAmount}}<tr><td class="lbl">{{taxLabel .TaxType}} {{if .TaxPct}}{{printf "%.0f" .TaxPct}}%{{else}}10%{{end}}</td><td>{{taxPrefix .TaxType}}{{formatRp .TaxAmount}}</td></tr>{{end}}
    <tr class="grand"><td>GRAND TOTAL</td><td>{{formatRp .TotalAmount}}</td></tr>
    <tr><td class="terb-label">Terbilang</td><td class="terb-value">{{terbilang .TotalAmount}}</td></tr>
  </table>
</div>

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

<!-- PAGE 2: TERMS & CONDITIONS -->
<div class="page-break terms-page">
  <div class="header">
    <div class="doc-heading">
      <h1>Quotations{{if gt .Revision 0}} (Revision {{.Revision}}){{end}}</h1>
      <p>{{.QuoteNumber}}</p>
    </div>
  </div>
  <div class="tc-hdr">TERMS &amp; CONDITIONS</div>
  <div class="tc-grid">
    <div class="tc-pasal"><strong>Pasal 1: Ruang Lingkup Layanan</strong>
    Archie Consultant menyediakan layanan konsultasi pajak, akuntansi, pembukuan, pendirian usaha, dan business advisory sesuai ruang lingkup yang disepakati dalam penawaran ini. Setiap layanan dijalankan berdasarkan kebutuhan bisnis klien dan dapat disesuaikan selama masa kerja sama.</div>

    <div class="tc-pasal"><strong>Pasal 2: Proses Pekerjaan</strong>
    Kerja sama dimulai dari konsultasi awal, assessment kebutuhan, rekomendasi ruang lingkup, implementasi, dan ongoing support. Hasil assessment dapat menjadi dasar penyesuaian deliverable, timeline, maupun biaya layanan.</div>

    <div class="tc-pasal"><strong>Pasal 3: Kewajiban Klien</strong>
    Klien wajib menyediakan data, dokumen, akses, dan konfirmasi yang diperlukan secara lengkap, benar, dan tepat waktu. Keterlambatan atau ketidaklengkapan data dapat memengaruhi jadwal pekerjaan dan hasil layanan.</div>

    <div class="tc-pasal"><strong>Pasal 4: Pajak dan Kepatuhan</strong>
    Untuk layanan pajak, klien bertanggung jawab atas kebenaran data transaksi dan dokumen pendukung. Archie Consultant membantu analisis, pelaporan, review kepatuhan, tax planning, Coretax, SP2DK, dan pemeriksaan pajak sesuai ruang lingkup yang disepakati, namun keputusan akhir tetap mengikuti ketentuan regulasi yang berlaku.</div>

    <div class="tc-pasal"><strong>Pasal 5: Akuntansi, Pembukuan, dan Setup</strong>
    Untuk layanan akuntansi, pembukuan, dan company setup, pekerjaan mencakup pencatatan, rekonsiliasi, penyusunan laporan, administrasi usaha, dan rekomendasi perbaikan sistem. Implementasi mengikuti kondisi data dan proses bisnis klien pada saat pekerjaan dimulai.</div>
  </div>
</div>

<!-- PAGE 3: TERMS & CONDITIONS CONTINUATION -->
<div class="page-break terms-page">
  <div class="header">
    <div class="doc-heading">
      <h1>Quotations{{if gt .Revision 0}} (Revision {{.Revision}}){{end}}</h1>
      <p>{{.QuoteNumber}}</p>
    </div>
  </div>
  <div class="tc-hdr">TERMS &amp; CONDITIONS</div>
  <div class="tc-grid">
    <div class="tc-pasal"><strong>Pasal 6: Biaya dan Pembayaran</strong>
    Biaya layanan mengikuti penawaran yang telah disetujui. Pembayaran dilakukan sesuai termin yang tercantum pada quotation atau invoice. Pekerjaan dapat ditunda apabila pembayaran jatuh tempo belum diselesaikan.</div>

    <div class="tc-pasal"><strong>Pasal 7: Deliverables dan Revisi</strong>
    Deliverables berupa laporan, review, rekomendasi, file kerja, atau dokumen pendukung lain yang dijelaskan dalam ruang lingkup. Revisi di luar scope awal atau perubahan besar setelah approval dapat menjadi pekerjaan tambahan.</div>

    <div class="tc-pasal"><strong>Pasal 8: Kerahasiaan</strong>
    Seluruh data, dokumen, dan informasi bisnis klien diperlakukan sebagai rahasia dan hanya digunakan untuk pelaksanaan pekerjaan. Archie Consultant menjaga kerahasiaan sepanjang kerja sama dan setelah kerja sama berakhir, kecuali diwajibkan oleh hukum.</div>

    <div class="tc-pasal"><strong>Pasal 9: Batasan Tanggung Jawab</strong>
    Archie Consultant bekerja berdasarkan data dan informasi yang diberikan klien. Kami tidak bertanggung jawab atas konsekuensi yang timbul dari data yang tidak lengkap, tidak akurat, atau perubahan regulasi yang terjadi di luar kendali selama pekerjaan berlangsung.</div>

    <div class="tc-pasal"><strong>Pasal 10: Pengakhiran dan Force Majeure</strong>
    Kerja sama dapat diakhiri berdasarkan kesepakatan para pihak atau kondisi force majeure yang menghambat pelaksanaan pekerjaan. Dalam kondisi demikian, para pihak akan melakukan penyesuaian atas timeline, ruang lingkup, atau pengakhiran kerja sama secara wajar.</div>
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
