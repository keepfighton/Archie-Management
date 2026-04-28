package models

import (
	"database/sql/driver"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
)

// FlexTime accepts both RFC3339 and date-only ("2006-01-02") JSON input,
// and implements driver.Valuer / sql.Scanner so GORM can persist it.
type FlexTime struct{ time.Time }

func (f *FlexTime) UnmarshalJSON(data []byte) error {
	s := strings.Trim(string(data), `"`)
	if s == "" || s == "null" || s == "0001-01-01T00:00:00Z" {
		f.Time = time.Time{}
		return nil
	}
	for _, layout := range []string{time.RFC3339, "2006-01-02T15:04:05Z07:00", "2006-01-02T15:04", "2006-01-02"} {
		if t, err := time.Parse(layout, s); err == nil {
			f.Time = t
			return nil
		}
	}
	return nil
}

func (f FlexTime) MarshalJSON() ([]byte, error) {
	return f.Time.MarshalJSON()
}

// driver.Valuer — writes to DB as time.Time
func (f FlexTime) Value() (driver.Value, error) {
	return f.Time, nil
}

// sql.Scanner — reads from DB
func (f *FlexTime) Scan(value interface{}) error {
	if value == nil {
		f.Time = time.Time{}
		return nil
	}
	switch v := value.(type) {
	case time.Time:
		f.Time = v
	case []byte:
		t, err := time.Parse("2006-01-02 15:04:05", string(v))
		if err != nil {
			return err
		}
		f.Time = t
	case string:
		t, err := time.Parse("2006-01-02 15:04:05", v)
		if err != nil {
			return err
		}
		f.Time = t
	default:
		return fmt.Errorf("unsupported type: %T", value)
	}
	return nil
}

// Base model
type Base struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// ─── USER ───────────────────────────────────────────
type User struct {
	Base
	Name             string     `gorm:"not null" json:"name"`
	Email            string     `gorm:"uniqueIndex;not null" json:"email"`
	Password         string     `gorm:"not null" json:"-"`
	JobTitle         string     `json:"job_title"`
	Phone            string     `json:"phone"`
	Avatar           string     `json:"avatar"`
	Role             string     `gorm:"default:member" json:"role"` // admin, member (system role)
	IsActive         bool       `gorm:"default:true" json:"is_active"`
	ClockedIn        bool       `gorm:"default:false" json:"clocked_in"`
	AppRoleID        *uint      `json:"app_role_id"`
	AppRole          *AppRole   `gorm:"foreignKey:AppRoleID" json:"app_role,omitempty"`
	ResetToken       string     `gorm:"index" json:"-"`
	ResetTokenExpiry *time.Time `json:"-"`
	TimeCards        []TimeCard `json:"time_cards,omitempty"`
	Leaves           []Leave    `json:"leaves,omitempty"`
}

// ─── APP ROLE (Dynamic RBAC) ─────────────────────────
type AppRole struct {
	Base
	Name        string           `json:"name" gorm:"uniqueIndex;not null"`
	Description string           `json:"description"`
	Permissions []RolePermission `json:"permissions,omitempty" gorm:"foreignKey:AppRoleID;constraint:OnDelete:CASCADE"`
}

type RolePermission struct {
	ID        uint   `json:"id" gorm:"primaryKey;autoIncrement"`
	AppRoleID uint   `json:"app_role_id"`
	Menu      string `json:"menu"`
	CanRead   bool   `json:"can_read" gorm:"default:true"`
	CanEdit   bool   `json:"can_edit" gorm:"default:false"`
}

// ─── CLIENT ─────────────────────────────────────────
type Client struct {
	Base
	Name                 string    `gorm:"not null" json:"name"`
	Type                 string    `gorm:"default:company" json:"type"` // company, person
	Email                string    `json:"email"`
	Phone                string    `json:"phone"`
	Website              string    `json:"website"`
	Address              string    `json:"address"`
	City                 string    `json:"city"`
	State                string    `json:"state"`
	Zip                  string    `json:"zip"`
	Country              string    `json:"country"`
	VATNumber            string    `json:"vat_number"`
	GSTNumber            string    `json:"gst_number"`
	Managers             string    `json:"managers"`
	ClientGroups         string    `json:"client_groups"`
	Currency             string    `gorm:"default:IDR" json:"currency"`
	CurrencySymbol       string    `json:"currency_symbol"`
	LabelID              *uint     `json:"label_id"`
	Label                *Label    `gorm:"foreignKey:LabelID" json:"label,omitempty"`
	Needs                string    `json:"needs"`
	DisableOnlinePayment bool      `gorm:"default:false" json:"disable_online_payment"`
	OwnerID              uint      `json:"owner_id"`
	Owner                *User     `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
	Contacts             []Contact `json:"contacts,omitempty"`
	Projects             []Project `json:"projects,omitempty"`
	Labels               []Label   `gorm:"many2many:client_labels;" json:"labels,omitempty"`
}

type Contact struct {
	Base
	ClientID uint    `json:"client_id"`
	Client   *Client `gorm:"foreignKey:ClientID" json:"client,omitempty"`
	Name     string  `json:"name"`
	Email    string  `json:"email"`
	Phone    string  `json:"phone"`
	Position string  `json:"position"`
}

// ─── PROJECT ────────────────────────────────────────
type Project struct {
	Base
	Title       string   `gorm:"not null" json:"title"`
	ClientID    uint     `json:"client_id"`
	Client      *Client  `gorm:"foreignKey:ClientID" json:"client,omitempty"`
	Price       float64  `json:"price"`
	Currency    string   `gorm:"default:IDR" json:"currency"`
	StartDate   FlexTime `json:"start_date"`
	Deadline    FlexTime `json:"deadline"`
	Status      string   `gorm:"default:open" json:"status"` // open, completed, hold, cancelled
	Progress    int      `gorm:"default:0" json:"progress"`
	Description string   `json:"description"`
	Tasks       []Task   `json:"tasks,omitempty"`
	Labels      []Label  `gorm:"many2many:project_labels;" json:"labels,omitempty"`
	Members     []User   `gorm:"many2many:project_members;" json:"members,omitempty"`
}

// ─── TASK ────────────────────────────────────────────
type TaskKanbanColumn struct {
	Base
	Title    string `gorm:"not null" json:"title"`
	Status   string `gorm:"not null;index" json:"status"` // todo, in_progress, done, expired
	Position int    `gorm:"default:0;index" json:"position"`
	Tasks    []Task `gorm:"foreignKey:KanbanColumnID" json:"tasks,omitempty"`
}

type Task struct {
	Base
	Title          string            `gorm:"not null" json:"title"`
	ProjectID      *uint             `json:"project_id"`
	Project        *Project          `gorm:"foreignKey:ProjectID" json:"project,omitempty"`
	AssignedToID   *uint             `json:"assigned_to_id"`
	AssignedTo     *User             `gorm:"foreignKey:AssignedToID" json:"assigned_to,omitempty"`
	KanbanColumnID *uint             `json:"kanban_column_id"`
	KanbanColumn   *TaskKanbanColumn `gorm:"foreignKey:KanbanColumnID" json:"kanban_column,omitempty"`
	KanbanPosition int               `gorm:"default:0;index" json:"kanban_position"`
	StartDate      FlexTime          `json:"start_date"`
	Deadline       FlexTime          `json:"deadline"`
	Status         string            `gorm:"default:todo" json:"status"` // todo, in_progress, done, expired
	Milestone      string            `json:"milestone"`
	Description    string            `json:"description"`
	Priority       string            `gorm:"default:medium" json:"priority"`
	Collaborators  []User            `gorm:"many2many:task_collaborators;" json:"collaborators,omitempty"`
	Labels         []Label           `gorm:"many2many:task_labels;" json:"labels,omitempty"`
}

// ─── LEAD ────────────────────────────────────────────
type Lead struct {
	Base
	Name           string  `gorm:"not null" json:"name"`
	PrimaryContact string  `json:"primary_contact"`
	Phone          string  `json:"phone"`
	Email          string  `json:"email"`
	Source         string  `json:"source"`
	Status         string  `gorm:"default:new" json:"status"` // new, qualified, discussion, negotiation, won, lost
	OwnerID        uint    `json:"owner_id"`
	Owner          *User   `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
	Notes          string  `json:"notes"`
	Labels         []Label `gorm:"many2many:lead_labels;" json:"labels,omitempty"`
}

// ─── INVOICE ─────────────────────────────────────────
type Invoice struct {
	Base
	InvoiceNumber  string        `gorm:"uniqueIndex;not null" json:"invoice_number"`
	ClientID       uint          `json:"client_id"`
	Client         *Client       `gorm:"foreignKey:ClientID" json:"client,omitempty"`
	ProjectID      *uint         `json:"project_id"`
	Project        *Project      `gorm:"foreignKey:ProjectID" json:"project,omitempty"`
	BillDate       FlexTime      `json:"bill_date"`
	DueDate        FlexTime      `json:"due_date"`
	Status         string        `gorm:"default:draft" json:"status"` // draft, not_paid, partially_paid, fully_paid, overdue
	Currency       string        `gorm:"default:IDR" json:"currency"`
	SubtotalAmount float64       `gorm:"-" json:"subtotal_amount"`
	TotalAmount    float64       `json:"total_amount"`
	TaxAmount      float64       `json:"tax_amount"`
	DiscountAmount float64       `json:"discount_amount"`
	PaidAmount     float64       `json:"paid_amount"`
	DueAmount      float64       `json:"due_amount"`
	Notes          string        `json:"notes"`
	Items          []InvoiceItem `json:"items,omitempty"`
	Payments       []Payment     `json:"payments,omitempty"`
	Labels         []Label       `gorm:"many2many:invoice_labels;" json:"labels,omitempty"`
}

type InvoiceItem struct {
	Base
	InvoiceID   uint    `json:"invoice_id"`
	Description string  `json:"description"`
	Quantity    float64 `json:"quantity"`
	UnitPrice   float64 `json:"unit_price"`
	Total       float64 `json:"total"`
}

// ─── PAYMENT ─────────────────────────────────────────
type Payment struct {
	Base
	InvoiceID     uint     `json:"invoice_id"`
	Invoice       *Invoice `gorm:"foreignKey:InvoiceID" json:"invoice,omitempty"`
	Amount        float64  `json:"amount"`
	Currency      string   `gorm:"default:IDR" json:"currency"`
	PaymentDate   FlexTime `json:"payment_date"`
	PaymentMethod string   `json:"payment_method"`
	Note          string   `json:"note"`
}

// ─── CONTRACT ────────────────────────────────────────
type Contract struct {
	Base
	ContractNumber string   `gorm:"uniqueIndex" json:"contract_number"`
	Title          string   `gorm:"not null" json:"title"`
	ClientID       uint     `json:"client_id"`
	Client         *Client  `gorm:"foreignKey:ClientID" json:"client,omitempty"`
	ProjectID      *uint    `json:"project_id"`
	Project        *Project `gorm:"foreignKey:ProjectID" json:"project,omitempty"`
	ContractDate   FlexTime `json:"contract_date"`
	ValidUntil     FlexTime `json:"valid_until"`
	Amount         float64  `json:"amount"`
	Currency       string   `gorm:"default:IDR" json:"currency"`
	Status         string   `gorm:"default:draft" json:"status"`
	FileURL        string   `json:"file_url"`
}

// ─── ITEM (Product/Service) ───────────────────────────
type Item struct {
	Base
	Title       string  `gorm:"not null" json:"title"`
	Description string  `json:"description"`
	Category    string  `json:"category"`
	UnitType    string  `json:"unit_type"`
	Rate        float64 `json:"rate"`
	Currency    string  `gorm:"default:IDR" json:"currency"`
}

// ─── ORDER ───────────────────────────────────────────
type Order struct {
	Base
	OrderNumber string    `gorm:"uniqueIndex" json:"order_number"`
	ClientID    uint      `json:"client_id"`
	Client      *Client   `gorm:"foreignKey:ClientID" json:"client,omitempty"`
	OrderDate   FlexTime  `json:"order_date"`
	Amount      float64   `json:"amount"`
	Currency    string    `gorm:"default:IDR" json:"currency"`
	Status      string    `gorm:"default:pending" json:"status"`
	Invoices    []Invoice `gorm:"many2many:order_invoices;" json:"invoices,omitempty"`
}

// ─── EVENT ───────────────────────────────────────────
type Event struct {
	Base
	Title       string   `gorm:"not null" json:"title"`
	Description string   `json:"description"`
	StartDate   FlexTime `json:"start_date"`
	EndDate     FlexTime `json:"end_date"`
	AllDay      bool     `json:"all_day"`
	Color       string   `gorm:"default:#3b82f6" json:"color"`
	Type        string   `json:"type"`
	CreatedByID uint     `json:"created_by_id"`
	CreatedBy   *User    `gorm:"foreignKey:CreatedByID" json:"created_by,omitempty"`
	Labels      []Label  `gorm:"many2many:event_labels;" json:"labels,omitempty"`
}

// ─── NOTE ────────────────────────────────────────────
type Note struct {
	Base
	Title    string `json:"title"`
	Content  string `json:"content"`
	Category string `json:"category"`
	UserID   uint   `json:"user_id"`
	User     *User  `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// ─── EXPENSE ─────────────────────────────────────────
type Expense struct {
	Base
	Date        FlexTime `json:"date"`
	Category    string   `json:"category"`
	Title       string   `gorm:"not null" json:"title"`
	Description string   `json:"description"`
	Amount      float64  `json:"amount"`
	Tax         float64  `json:"tax"`
	SecondTax   float64  `json:"second_tax"`
	Total       float64  `json:"total"`
	FileURL     string   `json:"file_url"`
	UserID      uint     `json:"user_id"`
	User        *User    `gorm:"foreignKey:UserID" json:"user,omitempty"`
	IsRecurring bool     `gorm:"default:false" json:"is_recurring"`
}

// ─── LEAVE ───────────────────────────────────────────
type Leave struct {
	Base
	UserID    uint     `json:"user_id"`
	User      *User    `gorm:"foreignKey:UserID" json:"user,omitempty"`
	LeaveType string   `json:"leave_type"`
	StartDate FlexTime `json:"start_date"`
	EndDate   FlexTime `json:"end_date"`
	Duration  int      `json:"duration"`
	Reason    string   `json:"reason"`
	Status    string   `gorm:"default:pending" json:"status"` // pending, approved, rejected
}

// ─── ANNOUNCEMENT ────────────────────────────────────
type Announcement struct {
	Base
	Title       string   `gorm:"not null" json:"title"`
	Content     string   `json:"content"`
	StartDate   FlexTime `json:"start_date"`
	EndDate     FlexTime `json:"end_date"`
	CreatedByID uint     `json:"created_by_id"`
	CreatedBy   *User    `gorm:"foreignKey:CreatedByID" json:"created_by,omitempty"`
}

// ─── TIME CARD ───────────────────────────────────────
type TimeCard struct {
	Base
	UserID   uint       `json:"user_id"`
	User     *User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	InDate   time.Time  `json:"in_date"`
	InTime   time.Time  `json:"in_time"`
	OutDate  *time.Time `json:"out_date"`
	OutTime  *time.Time `json:"out_time"`
	Duration float64    `json:"duration"` // in hours
	Note     string     `json:"note"`
}

// ─── FILE ────────────────────────────────────────────
type File struct {
	Base
	Name       string `gorm:"not null" json:"name"`
	Path       string `json:"path"`
	URL        string `json:"url"`
	Size       int64  `json:"size"`
	MimeType   string `json:"mime_type"`
	FolderID   *uint  `json:"folder_id"`
	Folder     *File  `gorm:"foreignKey:FolderID" json:"folder,omitempty"`
	IsFolder   bool   `gorm:"default:false" json:"is_folder"`
	IsFavorite bool   `gorm:"default:false" json:"is_favorite"`
	OwnerID    uint   `json:"owner_id"`
	Owner      *User  `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
}

// ─── TODO ────────────────────────────────────────────
type Todo struct {
	Base
	Title  string     `gorm:"not null" json:"title"`
	Done   bool       `gorm:"default:false" json:"done"`
	DoneAt *time.Time `json:"done_at"`
	UserID uint       `json:"user_id"`
	User   *User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Labels []Label    `gorm:"many2many:todo_labels;" json:"labels,omitempty"`
}

// ─── LABEL ───────────────────────────────────────────
type Label struct {
	Base
	Name  string `gorm:"not null" json:"name"`
	Color string `gorm:"default:#3b82f6" json:"color"`
}

// ─── AUDIT LOG ───────────────────────────────────────
type AuditLog struct {
	ID         uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID     uint      `json:"user_id"`
	User       User      `json:"user" gorm:"foreignKey:UserID"`
	Action     string    `json:"action"`      // create, update, delete
	EntityType string    `json:"entity_type"` // client, invoice, project, task, lead, contract
	EntityID   uint      `json:"entity_id"`
	EntityName string    `json:"entity_name"`
	IPAddress  string    `json:"ip_address"`
	CreatedAt  time.Time `json:"created_at"`
}
