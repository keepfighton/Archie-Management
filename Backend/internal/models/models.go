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

// ─── INTERNAL MESSAGING ─────────────────────────────
type UserPresence struct {
	Base
	UserID     uint      `gorm:"uniqueIndex;not null" json:"user_id"`
	User       *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Status     string    `gorm:"default:online" json:"status"` // online, away, offline
	LastSeenAt time.Time `gorm:"index" json:"last_seen_at"`
}

type Conversation struct {
	Base
	Type        string               `gorm:"default:direct;index" json:"type"` // direct, group
	Name        string               `json:"name"`
	CreatedByID uint                 `json:"created_by_id"`
	CreatedBy   *User                `gorm:"foreignKey:CreatedByID" json:"created_by,omitempty"`
	Members     []ConversationMember `json:"members,omitempty"`
	Messages    []Message            `json:"messages,omitempty"`
}

type ConversationMember struct {
	ID             uint          `gorm:"primaryKey;autoIncrement" json:"id"`
	ConversationID uint          `gorm:"uniqueIndex:idx_conversation_member;not null" json:"conversation_id"`
	Conversation   *Conversation `gorm:"foreignKey:ConversationID" json:"conversation,omitempty"`
	UserID         uint          `gorm:"uniqueIndex:idx_conversation_member;not null" json:"user_id"`
	User           *User         `gorm:"foreignKey:UserID" json:"user,omitempty"`
	LastReadAt     *time.Time    `json:"last_read_at"`
	CreatedAt      time.Time     `json:"created_at"`
	UpdatedAt      time.Time     `json:"updated_at"`
}

type Message struct {
	Base
	ConversationID uint          `gorm:"index;not null" json:"conversation_id"`
	Conversation   *Conversation `gorm:"foreignKey:ConversationID" json:"conversation,omitempty"`
	SenderID       uint          `gorm:"index;not null" json:"sender_id"`
	Sender         *User         `gorm:"foreignKey:SenderID" json:"sender,omitempty"`
	Body           string        `gorm:"type:text;not null" json:"body"`
	MessageType    string        `gorm:"default:text" json:"message_type"` // text, file, system
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
type Cluster struct {
	Base
	Name        string    `gorm:"not null;uniqueIndex" json:"name"`
	Description string    `gorm:"type:text" json:"description"`
	Projects    []Project `json:"projects,omitempty"`
}

type Project struct {
	Base
	Title       string    `gorm:"not null" json:"title"`
	ClusterID   *uint     `gorm:"index" json:"cluster_id"`
	Cluster     *Cluster  `gorm:"foreignKey:ClusterID" json:"cluster,omitempty"`
	PicID       *uint     `gorm:"index" json:"pic_id"`
	Pic         *User     `gorm:"foreignKey:PicID" json:"pic,omitempty"`
	ClientID    uint      `json:"client_id"`
	Client      *Client   `gorm:"foreignKey:ClientID" json:"client,omitempty"`
	ContractID  *uint     `gorm:"index" json:"contract_id"`
	Contract    *Contract `gorm:"foreignKey:ContractID" json:"contract,omitempty"`
	Price       float64   `json:"price"`
	Currency    string    `gorm:"default:IDR" json:"currency"`
	StartDate   FlexTime  `json:"start_date"`
	Deadline    FlexTime  `json:"deadline"`
	Status      string    `gorm:"default:open" json:"status"` // open, in_progress, completed, hold, cancelled
	Progress    int       `gorm:"default:0" json:"progress"`
	Description string    `json:"description"`
	Tasks       []Task    `json:"tasks,omitempty"`
	Labels      []Label   `gorm:"many2many:project_labels;" json:"labels,omitempty"`
	Members     []User    `gorm:"many2many:project_members;" json:"members,omitempty"`
}

// ─── INTERNAL PROJECT ───────────────────────────────
// Internal projects are intentionally isolated from client projects. They use
// Archie Management users for ownership and membership, but have no client, contract, or
// finance relationships.
type InternalProject struct {
	Base
	Name        string                  `gorm:"not null" json:"name"`
	Description string                  `gorm:"type:text" json:"description"`
	OwnerID     uint                    `gorm:"index;not null" json:"owner_id"`
	Owner       *User                   `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
	Status      string                  `gorm:"default:active;index" json:"status"` // active, archived
	Progress    int                     `gorm:"default:0" json:"progress"`
	Members     []InternalProjectMember `gorm:"foreignKey:ProjectID" json:"members,omitempty"`
	Columns     []InternalProjectColumn `gorm:"foreignKey:ProjectID" json:"columns,omitempty"`
	Tasks       []InternalTask          `gorm:"foreignKey:ProjectID" json:"tasks,omitempty"`
}

type InternalProjectMember struct {
	Base
	ProjectID uint             `gorm:"uniqueIndex:idx_internal_project_user;not null" json:"project_id"`
	Project   *InternalProject `gorm:"foreignKey:ProjectID;constraint:OnDelete:CASCADE" json:"project,omitempty"`
	UserID    uint             `gorm:"uniqueIndex:idx_internal_project_user;not null" json:"user_id"`
	User      *User            `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Role      string           `gorm:"default:member" json:"role"` // owner, member
}

type InternalProjectColumn struct {
	Base
	ProjectID uint             `gorm:"uniqueIndex:idx_internal_project_column_key;not null" json:"project_id"`
	Project   *InternalProject `gorm:"foreignKey:ProjectID;constraint:OnDelete:CASCADE" json:"project,omitempty"`
	Key       string           `gorm:"uniqueIndex:idx_internal_project_column_key;not null" json:"key"`
	Label     string           `gorm:"not null" json:"label"`
	Color     string           `json:"color"`
	Position  int              `gorm:"default:0;index" json:"position"`
}

type InternalTask struct {
	Base
	ProjectID    uint                   `gorm:"index;not null" json:"project_id"`
	Project      *InternalProject       `gorm:"foreignKey:ProjectID;constraint:OnDelete:CASCADE" json:"project,omitempty"`
	ColumnID     uint                   `gorm:"index;not null" json:"column_id"`
	Column       *InternalProjectColumn `gorm:"foreignKey:ColumnID" json:"column,omitempty"`
	Title        string                 `gorm:"not null" json:"title"`
	Description  string                 `gorm:"type:text" json:"description"`
	Category     string                 `json:"category"`
	Status       string                 `gorm:"default:backlog;index" json:"status"`
	Priority     string                 `gorm:"default:medium;index" json:"priority"`
	DueDate      *time.Time             `gorm:"index" json:"due_date"`
	CreatorID    uint                   `gorm:"index;not null" json:"creator_id"`
	Creator      *User                  `gorm:"foreignKey:CreatorID" json:"creator,omitempty"`
	ParentTaskID *uint                  `gorm:"index" json:"parent_task_id"`
	Position     int                    `gorm:"default:0;index" json:"position"`
	Assignees    []InternalTaskAssignee `gorm:"foreignKey:TaskID" json:"assignees,omitempty"`
	TimeLogs     []InternalTimeLog      `gorm:"foreignKey:TaskID" json:"time_logs,omitempty"`
}

type InternalTaskAssignee struct {
	ID        uint          `gorm:"primaryKey;autoIncrement" json:"id"`
	TaskID    uint          `gorm:"uniqueIndex:idx_internal_task_user;not null" json:"task_id"`
	Task      *InternalTask `gorm:"foreignKey:TaskID;constraint:OnDelete:CASCADE" json:"task,omitempty"`
	UserID    uint          `gorm:"uniqueIndex:idx_internal_task_user;not null" json:"user_id"`
	User      *User         `gorm:"foreignKey:UserID" json:"user,omitempty"`
	CreatedAt time.Time     `json:"created_at"`
}

type InternalTimeLog struct {
	Base
	TaskID          uint             `gorm:"index;not null" json:"task_id"`
	Task            *InternalTask    `gorm:"foreignKey:TaskID;constraint:OnDelete:CASCADE" json:"task,omitempty"`
	SubtaskID       *uint            `gorm:"index" json:"subtask_id"`
	Subtask         *InternalSubtask `gorm:"foreignKey:SubtaskID;constraint:OnDelete:SET NULL" json:"subtask,omitempty"`
	UserID          uint             `gorm:"index;not null" json:"user_id"`
	User            *User            `gorm:"foreignKey:UserID" json:"user,omitempty"`
	ClockIn         time.Time        `gorm:"index;not null" json:"clock_in"`
	ClockOut        *time.Time       `gorm:"index" json:"clock_out"`
	DurationSeconds int64            `gorm:"default:0" json:"duration_seconds"`
}

type InternalSubtask struct {
	Base
	TaskID           uint          `gorm:"index;not null" json:"task_id"`
	Task             *InternalTask `gorm:"foreignKey:TaskID;constraint:OnDelete:CASCADE" json:"task,omitempty"`
	Title            string        `gorm:"not null" json:"title"`
	Description      string        `gorm:"type:text" json:"description"`
	Status           string        `gorm:"default:pending;index" json:"status"` // pending, completed
	Position         int           `gorm:"default:0;index" json:"position"`
	AssigneeID       *uint         `gorm:"index" json:"assignee_id"`
	Assignee         *User         `gorm:"foreignKey:AssigneeID" json:"assignee,omitempty"`
	DueDate          *FlexTime     `json:"due_date"`
	EstimatedSeconds int64         `gorm:"default:0" json:"estimated_seconds"`
}

type InternalTaskComment struct {
	Base
	TaskID   uint                         `gorm:"index;not null" json:"task_id"`
	Task     *InternalTask                `gorm:"foreignKey:TaskID;constraint:OnDelete:CASCADE" json:"task,omitempty"`
	UserID   uint                         `gorm:"index;not null" json:"user_id"`
	User     *User                        `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Body     string                       `gorm:"type:text;not null" json:"body"`
	Mentions []InternalTaskCommentMention `gorm:"foreignKey:CommentID" json:"mentions,omitempty"`
}

type InternalTaskCommentMention struct {
	ID        uint                 `gorm:"primaryKey;autoIncrement" json:"id"`
	CommentID uint                 `gorm:"uniqueIndex:idx_internal_comment_user;not null" json:"comment_id"`
	Comment   *InternalTaskComment `gorm:"foreignKey:CommentID;constraint:OnDelete:CASCADE" json:"comment,omitempty"`
	UserID    uint                 `gorm:"uniqueIndex:idx_internal_comment_user;not null" json:"user_id"`
	User      *User                `gorm:"foreignKey:UserID" json:"user,omitempty"`
	CreatedAt time.Time            `json:"created_at"`
}

type InternalTaskAttachment struct {
	Base
	TaskID       uint          `gorm:"index;not null" json:"task_id"`
	Task         *InternalTask `gorm:"foreignKey:TaskID;constraint:OnDelete:CASCADE" json:"task,omitempty"`
	FileID       uint          `gorm:"uniqueIndex;not null" json:"file_id"`
	File         *File         `gorm:"foreignKey:FileID" json:"file,omitempty"`
	UploadedByID uint          `gorm:"index;not null" json:"uploaded_by_id"`
	UploadedBy   *User         `gorm:"foreignKey:UploadedByID" json:"uploaded_by,omitempty"`
}

type InternalTaskReferenceLink struct {
	Base
	TaskID      uint          `gorm:"index;not null" json:"task_id"`
	Task        *InternalTask `gorm:"foreignKey:TaskID;constraint:OnDelete:CASCADE" json:"task,omitempty"`
	Title       string        `gorm:"not null" json:"title"`
	URL         string        `gorm:"type:text;not null" json:"url"`
	CreatedByID uint          `gorm:"index;not null" json:"created_by_id"`
	CreatedBy   *User         `gorm:"foreignKey:CreatedByID" json:"created_by,omitempty"`
}

type InternalTaskActivity struct {
	Base
	TaskID      uint          `gorm:"index;not null" json:"task_id"`
	Task        *InternalTask `gorm:"foreignKey:TaskID;constraint:OnDelete:CASCADE" json:"task,omitempty"`
	UserID      uint          `gorm:"index;not null" json:"user_id"`
	User        *User         `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Action      string        `gorm:"index;not null" json:"action"`
	Description string        `gorm:"type:text;not null" json:"description"`
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
	Name              string      `gorm:"not null" json:"name"`
	PrimaryContact    string      `json:"primary_contact"`
	Phone             string      `json:"phone"`
	Email             string      `json:"email"`
	Source            string      `json:"source"`
	Status            string      `gorm:"default:new" json:"status"` // new, qualified, discussion, negotiation, won, lost
	EstimatedValue    float64     `json:"estimated_value"`
	Currency          string      `gorm:"default:IDR" json:"currency"`
	OwnerID           uint        `json:"owner_id"`
	Owner             *User       `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
	Notes             string      `json:"notes"`
	ConvertedClientID *uint       `gorm:"index" json:"converted_client_id"`
	ConvertedClient   *Client     `gorm:"foreignKey:ConvertedClientID" json:"converted_client,omitempty"`
	Labels            []Label     `gorm:"many2many:lead_labels;" json:"labels,omitempty"`
	Quotations        []Quotation `gorm:"foreignKey:LeadID" json:"quotations,omitempty"`
}

// ─── INVOICE ─────────────────────────────────────────
type Invoice struct {
	Base
	InvoiceNumber   string        `gorm:"uniqueIndex;not null" json:"invoice_number"`
	ClientID        uint          `json:"client_id"`
	Client          *Client       `gorm:"foreignKey:ClientID" json:"client,omitempty"`
	ProjectID       *uint         `json:"project_id"`
	Project         *Project      `gorm:"foreignKey:ProjectID" json:"project,omitempty"`
	ParentInvoiceID *uint         `gorm:"index" json:"parent_invoice_id"`
	ParentInvoice   *Invoice      `gorm:"foreignKey:ParentInvoiceID" json:"parent_invoice,omitempty"`
	BillDate        FlexTime      `json:"bill_date"`
	DueDate         FlexTime      `json:"due_date"`
	Status          string        `gorm:"default:draft" json:"status"` // draft, not_paid, partially_paid, fully_paid, overdue
	Currency        string        `gorm:"default:IDR" json:"currency"`
	TaxType         string        `gorm:"default:ppn" json:"tax_type"`
	SubtotalAmount  float64       `gorm:"column:subtotal_amount" json:"subtotal_amount"`
	TotalAmount     float64       `gorm:"column:total_amount" json:"total_amount"`
	TaxAmount       float64       `gorm:"column:tax_amount" json:"tax_amount"`
	DiscountAmount  float64       `gorm:"column:discount_amount" json:"discount_amount"`
	PaidAmount      float64       `gorm:"column:paid_amount" json:"paid_amount"`
	DueAmount       float64       `gorm:"column:due_amount" json:"due_amount"`
	Notes           string        `json:"notes"`
	Items           []InvoiceItem `json:"items,omitempty"`
	Payments        []Payment     `json:"payments,omitempty"`
	Labels          []Label       `gorm:"many2many:invoice_labels;" json:"labels,omitempty"`
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
	ContractNumber  string   `gorm:"uniqueIndex" json:"contract_number"`
	Title           string   `gorm:"not null" json:"title"`
	ClientID        uint     `json:"client_id"`
	Client          *Client  `gorm:"foreignKey:ClientID" json:"client,omitempty"`
	ProjectID       *uint    `json:"project_id"`
	Project         *Project `gorm:"foreignKey:ProjectID" json:"project,omitempty"`
	ContractDate    FlexTime `json:"contract_date"`
	ValidUntil      FlexTime `json:"valid_until"`
	Amount          float64  `json:"amount"`
	Currency        string   `gorm:"default:IDR" json:"currency"`
	Status          string   `gorm:"default:draft" json:"status"`
	PreparedBy      string   `json:"prepared_by"`
	PreparedByTitle string   `json:"prepared_by_title"`
	FileURL         string   `json:"file_url"`
	FileName        string   `json:"file_name"`
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
	ProjectID   *uint     `json:"project_id"`
	Project     *Project  `gorm:"foreignKey:ProjectID" json:"project,omitempty"`
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
	ItemID      *uint     `gorm:"index" json:"item_id"`
	Item        *Item     `gorm:"foreignKey:ItemID" json:"item,omitempty"`
	Date        FlexTime  `json:"date"`
	Category    string    `json:"category"`
	Title       string    `gorm:"not null" json:"title"`
	Description string    `json:"description"`
	Amount      float64   `json:"amount"`
	Tax         float64   `json:"tax"`
	SecondTax   float64   `json:"second_tax"`
	Total       float64   `json:"total"`
	FileURL     string    `json:"file_url"`
	UserID      uint      `json:"user_id"`
	User        *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	IsRecurring bool      `gorm:"default:false" json:"is_recurring"`
	ContractID  *uint     `json:"contract_id"`
	Contract    *Contract `gorm:"foreignKey:ContractID" json:"contract,omitempty"`
	ClientID    *uint     `json:"client_id"`
	Client      *Client   `gorm:"foreignKey:ClientID" json:"client,omitempty"`
	ProjectID   *uint     `json:"project_id"`
	Project     *Project  `gorm:"foreignKey:ProjectID" json:"project,omitempty"`
}

// ─── LEAVE ───────────────────────────────────────────
type Leave struct {
	Base
	UserID       uint     `json:"user_id"`
	User         *User    `gorm:"foreignKey:UserID" json:"user,omitempty"`
	LeaveType    string   `json:"leave_type"`
	StartDate    FlexTime `json:"start_date"`
	EndDate      FlexTime `json:"end_date"`
	Duration     int      `json:"duration"`
	Reason       string   `json:"reason"`
	Status       string   `gorm:"default:pending" json:"status"` // pending, approved, rejected
	ApprovedByID *uint    `json:"approved_by_id"`
	ApprovedBy   *User    `gorm:"foreignKey:ApprovedByID" json:"approved_by,omitempty"`
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

// Notification stores personal, actionable notifications. Announcements remain
// company-wide broadcasts and are displayed alongside these items in the UI.
type Notification struct {
	Base
	UserID     uint       `gorm:"index;not null" json:"user_id"`
	User       *User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Type       string     `gorm:"index;not null" json:"type"`
	Title      string     `gorm:"not null" json:"title"`
	Message    string     `gorm:"type:text" json:"message"`
	Link       string     `json:"link"`
	EntityType string     `gorm:"index" json:"entity_type"`
	EntityID   uint       `gorm:"index" json:"entity_id"`
	UniqueKey  *string    `gorm:"uniqueIndex:idx_notification_user_key" json:"-"`
	ReadAt     *time.Time `gorm:"index" json:"read_at"`
}

// ─── TIME CARD ───────────────────────────────────────
type TimeCard struct {
	Base
	UserID           uint       `json:"user_id"`
	User             *User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	ProjectID        *uint      `json:"project_id"`
	Project          *Project   `gorm:"foreignKey:ProjectID" json:"project,omitempty"`
	InDate           time.Time  `json:"in_date"`
	InTime           time.Time  `json:"in_time"`
	OutDate          *time.Time `json:"out_date"`
	OutTime          *time.Time `json:"out_time"`
	Duration         float64    `json:"duration"` // in hours
	Note             string     `json:"note"`
	WorkMode         string     `gorm:"default:WFO" json:"work_mode"` // WFO, WFA, WFH
	Latitude         float64    `json:"latitude"`
	Longitude        float64    `json:"longitude"`
	DistanceM        float64    `json:"distance_m"`        // jarak dari titik kantor (meter)
	LocationAccuracy float64    `json:"location_accuracy"` // akurasi GPS browser (meter)
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

// ─── MILESTONE ───────────────────────────────────────
type Milestone struct {
	Base
	ProjectID   uint     `gorm:"not null;index" json:"project_id"`
	Project     *Project `gorm:"foreignKey:ProjectID" json:"project,omitempty"`
	Name        string   `gorm:"not null" json:"name"`
	Description string   `json:"description"`
	DueDate     FlexTime `json:"due_date"`
	Status      string   `gorm:"default:pending" json:"status"` // pending, in_progress, done
	AssigneeID  *uint    `json:"assignee_id"`
	Assignee    *User    `gorm:"foreignKey:AssigneeID" json:"assignee,omitempty"`
}

// ─── DELIVERABLE ─────────────────────────────────────
type Deliverable struct {
	Base
	ProjectID   uint     `gorm:"not null;index" json:"project_id"`
	Project     *Project `gorm:"foreignKey:ProjectID" json:"project,omitempty"`
	Name        string   `gorm:"not null" json:"name"`
	Description string   `json:"description"`
	DueDate     FlexTime `json:"due_date"`
	Status      string   `gorm:"default:draft" json:"status"` // draft, submitted, approved
	FileID      *uint    `json:"file_id"`
	File        *File    `gorm:"foreignKey:FileID" json:"file,omitempty"`
}

// ─── QUOTATION ───────────────────────────────────────
type Quotation struct {
	Base
	QuoteNumber     string          `json:"quote_number"`
	Revision        int             `json:"revision" gorm:"default:0"`
	Title           string          `json:"title"`
	ClientID        *uint           `json:"client_id"`
	Client          *Client         `gorm:"foreignKey:ClientID" json:"client,omitempty"`
	ProjectID       *uint           `json:"project_id"`
	Project         *Project        `gorm:"foreignKey:ProjectID" json:"project,omitempty"`
	IssueDate       FlexTime        `json:"issue_date"`
	ValidUntil      FlexTime        `json:"valid_until"`
	MasaBerlaku     string          `json:"masa_berlaku"`
	ContractNo      string          `json:"contract_no"`
	LeadID          *uint           `json:"lead_id"`
	Lead            *Lead           `gorm:"foreignKey:LeadID" json:"lead,omitempty"`
	Status          string          `gorm:"default:draft" json:"status"` // draft, sent, accepted, rejected, expired, converted
	Currency        string          `gorm:"default:IDR" json:"currency"`
	SubtotalAmount  float64         `json:"subtotal_amount"`
	DiscountPct     float64         `json:"discount_pct"`
	DiscountAmount  float64         `json:"discount_amount"`
	TaxPct          float64         `json:"tax_pct"`
	TaxType         string          `gorm:"default:ppn" json:"tax_type"`
	TaxAmount       float64         `json:"tax_amount"`
	TotalAmount     float64         `json:"total_amount"`
	PaymentTerms    string          `json:"payment_terms"`
	ScopeSummary    string          `json:"scope_summary" gorm:"type:text"`
	PreparedBy      string          `json:"prepared_by"`
	PreparedByTitle string          `json:"prepared_by_title"`
	ApprovedBy      string          `json:"approved_by"`
	ApprovedByTitle string          `json:"approved_by_title"`
	PIC             string          `json:"pic"`
	ContactPhone    string          `json:"contact_phone"`
	Terbilang       string          `json:"terbilang" gorm:"type:text"`
	AcceptanceNotes string          `json:"acceptance_notes" gorm:"type:text"`
	Notes           string          `json:"notes" gorm:"type:text"`
	FileURL         string          `json:"file_url"`
	FileName        string          `json:"file_name"`
	Items           []QuotationItem `gorm:"foreignKey:QuotationID" json:"items,omitempty"`
	DeletedAt       gorm.DeletedAt  `gorm:"index" json:"-"`
}

type QuotationItem struct {
	Base
	QuotationID  uint           `json:"quotation_id"`
	Quotation    *Quotation     `gorm:"foreignKey:QuotationID" json:"quotation,omitempty"`
	Description  string         `json:"description"`
	Quantity     float64        `json:"quantity"`
	UnitPrice    float64        `json:"unit_price"`
	Duration     float64        `json:"duration"`
	DurationUnit string         `json:"duration_unit"` // day, month, year
	Total        float64        `json:"total"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// ─── ASSET MASTER DATA ───────────────────────────────
// type: category | status | condition
type AssetMasterData struct {
	Base
	Type        string `gorm:"not null;index" json:"type"`
	Name        string `gorm:"not null" json:"name"`
	Description string `json:"description"`
	Color       string `gorm:"default:#6366f1" json:"color"`
}

// ─── ASSET ─────────────────────────────────────────
type Asset struct {
	Base
	AssetCode       string   `gorm:"uniqueIndex;not null" json:"asset_code"`
	Name            string   `gorm:"not null" json:"name"`
	Category        string   `json:"category"` // hardware, software, vehicle, furniture, office, other
	Brand           string   `json:"brand"`
	AssetModel      string   `json:"asset_model"`
	SerialNumber    string   `json:"serial_number"`
	Barcode         string   `json:"barcode"`
	PurchaseDate    FlexTime `json:"purchase_date"`
	PurchasePrice   float64  `json:"purchase_price"`
	Currency        string   `gorm:"default:IDR" json:"currency"`
	CurrentValue    float64  `gorm:"-" json:"current_value"`
	DepreciationPct float64  `json:"depreciation_pct"`
	Location        string   `json:"location"`
	Condition       string   `gorm:"default:good" json:"condition"` // good, fair, poor
	Status          string   `gorm:"default:active" json:"status"`  // active, maintenance, disposed, lost
	Notes           string   `json:"notes"`
	FileURL         string   `json:"file_url"`
	AssignedToID    *uint    `json:"assigned_to_id"`
	AssignedTo      *User    `gorm:"foreignKey:AssignedToID" json:"assigned_to,omitempty"`
	ProjectID       *uint    `json:"project_id"`
	Project         *Project `gorm:"foreignKey:ProjectID" json:"project,omitempty"`
	ExpenseID       *uint    `json:"expense_id"`
	Expense         *Expense `gorm:"foreignKey:ExpenseID" json:"expense,omitempty"`
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
