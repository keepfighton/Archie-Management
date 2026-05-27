package handlers

import (
	"encoding/csv"
	"fmt"
	"math"
	"net/http"
	"time"

	"github.com/cbqa/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AssetHandler struct{ db *gorm.DB }

func NewAssetHandler(db *gorm.DB) *AssetHandler { return &AssetHandler{db: db} }

func computeAssetCurrentValue(a *models.Asset) {
	if a.DepreciationPct <= 0 || a.PurchaseDate.IsZero() || a.PurchasePrice <= 0 {
		a.CurrentValue = a.PurchasePrice
		return
	}
	years := time.Since(a.PurchaseDate.Time).Hours() / 8760.0
	if years < 0 {
		years = 0
	}
	val := a.PurchasePrice * math.Pow(1-a.DepreciationPct/100, years)
	if val < 0 {
		val = 0
	}
	a.CurrentValue = math.Round(val*100) / 100
}

func (h *AssetHandler) List(c *gin.Context) {
	var q PaginationQuery
	c.ShouldBindQuery(&q)
	var assets []models.Asset
	var total int64

	query := h.db.Model(&models.Asset{}).
		Preload("AssignedTo").Preload("Project")

	if cat := c.Query("category"); cat != "" {
		query = query.Where("category = ?", cat)
	}
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if cond := c.Query("condition"); cond != "" {
		query = query.Where("condition = ?", cond)
	}
	if q.Q != "" {
		like := "%" + q.Q + "%"
		query = query.Where(
			"name ILIKE ? OR asset_code ILIKE ? OR serial_number ILIKE ? OR barcode ILIKE ? OR location ILIKE ? OR brand ILIKE ?",
			like, like, like, like, like, like,
		)
	}

	query.Count(&total)
	query.Scopes(paginate(q)).Order("assets.id desc").Find(&assets)

	for i := range assets {
		computeAssetCurrentValue(&assets[i])
	}

	c.JSON(http.StatusOK, gin.H{"data": assets, "total": total})
}

func (h *AssetHandler) Create(c *gin.Context) {
	resetSequenceIfEmpty(h.db, "assets")
	var asset models.Asset
	if err := c.ShouldBindJSON(&asset); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if asset.AssetCode == "" {
		asset.AssetCode = fmt.Sprintf("AST-%d-%05d", time.Now().Year(), time.Now().UnixMilli()%100000)
	}
	if err := h.db.Create(&asset).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.db.Preload("AssignedTo").Preload("Project").Preload("Expense").First(&asset, asset.ID)
	computeAssetCurrentValue(&asset)
	c.JSON(http.StatusCreated, asset)
}

func (h *AssetHandler) Get(c *gin.Context) {
	id, ok := mustGetID(c)
	if !ok {
		return
	}
	var asset models.Asset
	if err := h.db.Preload("AssignedTo").Preload("Project").Preload("Expense").First(&asset, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	computeAssetCurrentValue(&asset)
	c.JSON(http.StatusOK, asset)
}

func (h *AssetHandler) Update(c *gin.Context) {
	id, ok := mustGetID(c)
	if !ok {
		return
	}
	var asset models.Asset
	if err := h.db.First(&asset, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	if err := c.ShouldBindJSON(&asset); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.db.Save(&asset)
	h.db.Preload("AssignedTo").Preload("Project").Preload("Expense").First(&asset, asset.ID)
	computeAssetCurrentValue(&asset)
	c.JSON(http.StatusOK, asset)
}

func (h *AssetHandler) Delete(c *gin.Context) {
	id, _ := getID(c)
	h.db.Delete(&models.Asset{}, id)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// Scan looks up an asset by asset_code, barcode, or serial_number.
func (h *AssetHandler) Scan(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "code is required"})
		return
	}
	var asset models.Asset
	if err := h.db.Preload("AssignedTo").Preload("Project").
		Where("asset_code = ? OR barcode = ? OR serial_number = ?", code, code, code).
		First(&asset).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Asset not found"})
		return
	}
	computeAssetCurrentValue(&asset)
	c.JSON(http.StatusOK, asset)
}

func (h *AssetHandler) Export(c *gin.Context) {
	var assets []models.Asset
	h.db.Preload("AssignedTo").Preload("Project").Order("id").Find(&assets)

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=assets.csv")

	w := csv.NewWriter(c.Writer)
	w.Write([]string{"\xef\xbb\xbf"}) // UTF-8 BOM for Excel
	w.Write([]string{
		"Asset Code", "Name", "Category", "Brand", "Model",
		"Serial Number", "Barcode", "Purchase Date", "Purchase Price",
		"Current Value", "Depreciation %", "Currency",
		"Location", "Condition", "Status",
		"Assigned To", "Project", "Notes",
	})

	for i := range assets {
		computeAssetCurrentValue(&assets[i])
		a := assets[i]

		assignedTo := ""
		if a.AssignedTo != nil {
			assignedTo = a.AssignedTo.Name
		}
		project := ""
		if a.Project != nil {
			project = a.Project.Title
		}
		purchaseDate := ""
		if !a.PurchaseDate.IsZero() {
			purchaseDate = a.PurchaseDate.Format("2006-01-02")
		}

		w.Write([]string{
			a.AssetCode, a.Name, a.Category, a.Brand, a.AssetModel,
			a.SerialNumber, a.Barcode, purchaseDate,
			fmt.Sprintf("%.2f", a.PurchasePrice),
			fmt.Sprintf("%.2f", a.CurrentValue),
			fmt.Sprintf("%.2f", a.DepreciationPct),
			a.Currency,
			a.Location, a.Condition, a.Status,
			assignedTo, project, a.Notes,
		})
	}
	w.Flush()
}

// ─── ASSET MASTER DATA (Kategori / Status / Kondisi) ─

type AssetMasterDataHandler struct{ db *gorm.DB }

func NewAssetMasterDataHandler(db *gorm.DB) *AssetMasterDataHandler {
	return &AssetMasterDataHandler{db: db}
}

func (h *AssetMasterDataHandler) List(c *gin.Context) {
	mdType := c.Query("type")
	var items []models.AssetMasterData
	q := h.db.Order("name")
	if mdType != "" {
		q = q.Where("type = ?", mdType)
	}
	q.Find(&items)
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *AssetMasterDataHandler) Create(c *gin.Context) {
	var item models.AssetMasterData
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if item.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nama wajib diisi"})
		return
	}
	if item.Type == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Type wajib diisi (category/status/condition)"})
		return
	}
	if item.Color == "" {
		item.Color = "#6366f1"
	}
	if err := h.db.Create(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Nama sudah ada untuk tipe ini"})
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (h *AssetMasterDataHandler) Update(c *gin.Context) {
	id, ok := mustGetID(c)
	if !ok {
		return
	}
	var item models.AssetMasterData
	if err := h.db.First(&item, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if item.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nama wajib diisi"})
		return
	}
	h.db.Save(&item)
	c.JSON(http.StatusOK, item)
}

func (h *AssetMasterDataHandler) Delete(c *gin.Context) {
	id, _ := getID(c)
	var item models.AssetMasterData
	if err := h.db.First(&item, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	// Protect from deletion if in use
	var count int64
	switch item.Type {
	case "category":
		h.db.Model(&models.Asset{}).Where("category = ?", item.Name).Count(&count)
	case "status":
		h.db.Model(&models.Asset{}).Where("status = ?", item.Name).Count(&count)
	case "condition":
		h.db.Model(&models.Asset{}).Where("condition = ?", item.Name).Count(&count)
	}
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Nilai '%s' masih dipakai %d aset, tidak bisa dihapus", item.Name, count)})
		return
	}
	h.db.Delete(&models.AssetMasterData{}, id)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}
