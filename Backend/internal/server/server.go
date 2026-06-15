package server

import (
	"github.com/cbqa/backend/internal/config"
	"github.com/cbqa/backend/internal/handlers"
	"github.com/cbqa/backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type Server struct {
	cfg    *config.Config
	db     *gorm.DB
	router *gin.Engine
}

func New(cfg *config.Config, db *gorm.DB) *Server {
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	s := &Server{cfg: cfg, db: db, router: gin.Default()}
	s.setupRoutes()
	return s
}

func (s *Server) Run() error {
	return s.router.Run(":" + s.cfg.Port)
}

func (s *Server) setupRoutes() {
	s.router.Use(middleware.CORS())

	// Health check
	s.router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "version": "1.0.2"})
	})

	api := s.router.Group("/api/v1")

	// ─── Auth (public) ───────────────────────────────
	authH := handlers.NewAuthHandler(s.db, s.cfg)
	auth := api.Group("/auth")
	{
		auth.POST("/login", authH.Login)
		auth.POST("/register", authH.Register)
		auth.POST("/forgot-password", authH.ForgotPassword)
		auth.POST("/reset-password", authH.ResetPassword)
	}

	// ─── WhatsApp Cloud API webhook (public Meta callback) ───
	whatsAppH := handlers.NewWhatsAppHandler(s.db, s.cfg)
	whatsApp := api.Group("/whatsapp")
	{
		whatsApp.GET("/webhook", whatsAppH.VerifyWebhook)
		whatsApp.POST("/webhook", whatsAppH.ReceiveWebhook)
	}

	// ─── Protected routes ────────────────────────────
	protected := api.Group("")
	protected.Use(middleware.AuthRequired(s.cfg))
	{
		// Auth
		protected.GET("/auth/me", authH.Me)
		protected.POST("/auth/logout", authH.Logout)
		protected.PUT("/auth/change-password", authH.ChangePassword)

		// Personal notifications
		notificationH := handlers.NewNotificationHandler(s.db)
		protected.GET("/notifications", notificationH.List)
		protected.PATCH("/notifications/read-all", notificationH.MarkAllRead)
		protected.PATCH("/notifications/:id/read", notificationH.MarkRead)

		// Dashboard
		dashH := handlers.NewDashboardHandler(s.db)
		protected.GET("/dashboard", dashH.GetStats)
		protected.GET("/dashboard/funnel", dashH.GetFunnelStats)

		// Clients
		clientH := handlers.NewClientHandler(s.db)
		clients := protected.Group("/clients")
		{
			clients.GET("", clientH.List)
			clients.GET("/contacts", clientH.ListAllContacts)
			clients.POST("", clientH.Create)
			clients.GET("/:id", clientH.Get)
			clients.PUT("/:id", clientH.Update)
			clients.DELETE("/:id", clientH.Delete)
			clients.GET("/:id/contacts", clientH.GetContacts)
			clients.POST("/:id/contacts", clientH.AddContact)
			clients.PUT("/:id/contacts/:contactId", clientH.UpdateContact)
			clients.DELETE("/:id/contacts/:contactId", clientH.DeleteContact)
			clients.GET("/:id/projects", clientH.GetProjects)
			clients.GET("/:id/invoices", clientH.GetInvoices)
		}

		// Clusters
		clusterH := handlers.NewClusterHandler(s.db)
		clusters := protected.Group("/clusters")
		{
			clusters.GET("", clusterH.List)
			clusters.POST("", clusterH.Create)
			clusters.GET("/:id", clusterH.Get)
			clusters.PUT("/:id", clusterH.Update)
			clusters.DELETE("/:id", clusterH.Delete)
		}

		// Projects
		projectH := handlers.NewProjectHandler(s.db)
		projects := protected.Group("/projects")
		{
			projects.GET("", projectH.List)
			projects.POST("", projectH.Create)
			projects.GET("/:id", projectH.Get)
			projects.PUT("/:id", projectH.Update)
			projects.DELETE("/:id", projectH.Delete)
			projects.GET("/:id/tasks", projectH.GetTasks)
			projects.GET("/:id/timeline", projectH.GetTimeline)
			projects.GET("/:id/kanban-columns", projectH.GetKanbanColumns)
			projects.PATCH("/:id/status", projectH.PatchStatus)

			// Milestones
			milestoneH := handlers.NewMilestoneHandler(s.db)
			// NOTE: Use parameter name `id` to avoid gin panic caused by conflicting wildcards
			projects.GET("/:id/milestones", milestoneH.List)
			projects.POST("/:id/milestones", milestoneH.Create)
			projects.PUT("/:id/milestones/:mid", milestoneH.Update)
			projects.DELETE("/:id/milestones/:mid", milestoneH.Delete)

			// Deliverables
			deliverableH := handlers.NewDeliverableHandler(s.db)
			projects.GET("/:id/deliverables", deliverableH.List)
			projects.POST("/:id/deliverables", deliverableH.Create)
			projects.PUT("/:id/deliverables/:did", deliverableH.Update)
			projects.DELETE("/:id/deliverables/:did", deliverableH.Delete)
		}

		// Internal Projects (isolated from client projects)
		internalProjectH := handlers.NewInternalProjectHandler(s.db)
		internalDashboardRead := middleware.RequirePermission(s.db, "internal-project.dashboard", false)
		internalProjectsRead := middleware.RequirePermission(s.db, "internal-project.projects", false)
		internalProjectsEdit := middleware.RequirePermission(s.db, "internal-project.projects", true)
		internalTimesheetRead := middleware.RequirePermission(s.db, "internal-project.timesheet", false)
		internalTimesheetEdit := middleware.RequirePermission(s.db, "internal-project.timesheet", true)
		internalReportsRead := middleware.RequirePermission(s.db, "internal-project.reports", false)
		internalMembersRead := middleware.RequireAnyPermission(s.db, "internal-project.projects", "internal-project.timesheet")
		internalFilterOptionsRead := middleware.RequireAnyPermission(s.db,
			"internal-project.dashboard", "internal-project.projects", "internal-project.timesheet", "internal-project.reports")
		internalProjects := protected.Group("/internal-projects")
		{
			internalProjects.GET("/dashboard", internalDashboardRead, internalProjectH.Dashboard)
			internalProjects.GET("/time-summary", internalDashboardRead, internalProjectH.GetTimeSummary)
			internalProjects.GET("/reports/export", internalReportsRead, internalProjectH.ExportInternalProjectCSV)
			internalProjects.GET("/reports/summary", internalReportsRead, internalProjectH.PrintInternalProjectSummary)
			internalProjects.GET("", internalFilterOptionsRead, internalProjectH.List)
			internalProjects.POST("", internalProjectsEdit, internalProjectH.Create)
			internalProjects.GET("/:id", internalProjectsRead, internalProjectH.Get)
			internalProjects.PUT("/:id", internalProjectsEdit, internalProjectH.Update)
			internalProjects.DELETE("/:id", internalProjectsEdit, internalProjectH.Delete)
			internalProjects.GET("/:id/members", internalMembersRead, internalProjectH.ListMembers)
			internalProjects.POST("/:id/members", internalProjectsEdit, internalProjectH.AddMember)
			internalProjects.DELETE("/:id/members/:userId", internalProjectsEdit, internalProjectH.RemoveMember)
			internalProjects.GET("/:id/tasks", internalProjectsRead, internalProjectH.ListTasks)
			internalProjects.POST("/:id/tasks", internalProjectsEdit, internalProjectH.CreateTask)
			internalProjects.PUT("/:id/tasks/:taskId", internalProjectsEdit, internalProjectH.UpdateTask)
			internalProjects.PATCH("/:id/tasks/:taskId/move", internalProjectsEdit, internalProjectH.MoveTask)
			internalProjects.DELETE("/:id/tasks/:taskId", internalProjectsEdit, internalProjectH.DeleteTask)
			// Time tracking
			internalProjects.GET("/:id/time-logs", internalTimesheetRead, internalProjectH.GetProjectTimeLogs)
			internalProjects.GET("/tasks/:id/clock-in", internalTimesheetEdit, internalProjectH.ClockIn)
			internalProjects.POST("/tasks/:id/clock-in", internalTimesheetEdit, internalProjectH.ClockIn)
			internalProjects.GET("/tasks/:id/clock-out", internalTimesheetEdit, internalProjectH.ClockOut)
			internalProjects.POST("/tasks/:id/clock-out", internalTimesheetEdit, internalProjectH.ClockOut)
			internalProjects.GET("/tasks/:id/time-logs", internalTimesheetRead, internalProjectH.GetTimeLogs)
			internalProjects.POST("/tasks/:id/time-logs", internalTimesheetEdit, internalProjectH.CreateManualTimeLog)
			internalProjects.PUT("/tasks/:id/time-logs/:logId", internalTimesheetEdit, internalProjectH.UpdateTimeLog)
			internalProjects.DELETE("/tasks/:id/time-logs/:logId", internalTimesheetEdit, internalProjectH.DeleteTimeLog)
			internalProjects.GET("/my-time-logs", internalTimesheetRead, internalProjectH.GetMyTimeLogs)
			internalProjects.GET("/my-active-log", internalTimesheetRead, internalProjectH.GetActiveLog)
			internalProjects.GET("/my-tasks", internalProjectsRead, internalProjectH.GetMyTasks)
			// Subtasks
			internalProjects.GET("/tasks/:id/subtasks", internalProjectsRead, internalProjectH.ListSubtasks)
			internalProjects.POST("/tasks/:id/subtasks", internalProjectsEdit, internalProjectH.CreateSubtask)
			internalProjects.PUT("/tasks/:id/subtasks/:subtaskId", internalProjectsEdit, internalProjectH.UpdateSubtask)
			internalProjects.PATCH("/tasks/:id/subtasks/:subtaskId/toggle", internalProjectsEdit, internalProjectH.ToggleSubtaskStatus)
			internalProjects.DELETE("/tasks/:id/subtasks/:subtaskId", internalProjectsEdit, internalProjectH.DeleteSubtask)
			internalProjects.PATCH("/tasks/:id/subtasks/reorder", internalProjectsEdit, internalProjectH.ReorderSubtasks)
			// Task collaboration
			internalProjects.GET("/tasks/:id/comments", internalProjectsRead, internalProjectH.ListTaskComments)
			internalProjects.POST("/tasks/:id/comments", internalProjectsEdit, internalProjectH.CreateTaskComment)
			internalProjects.DELETE("/tasks/:id/comments/:commentId", internalProjectsEdit, internalProjectH.DeleteTaskComment)
			internalProjects.GET("/tasks/:id/attachments", internalProjectsRead, internalProjectH.ListTaskAttachments)
			internalProjects.POST("/tasks/:id/attachments", internalProjectsEdit, internalProjectH.CreateTaskAttachment)
			internalProjects.DELETE("/tasks/:id/attachments/:attachmentId", internalProjectsEdit, internalProjectH.DeleteTaskAttachment)
			internalProjects.GET("/tasks/:id/links", internalProjectsRead, internalProjectH.ListTaskReferenceLinks)
			internalProjects.POST("/tasks/:id/links", internalProjectsEdit, internalProjectH.CreateTaskReferenceLink)
			internalProjects.DELETE("/tasks/:id/links/:linkId", internalProjectsEdit, internalProjectH.DeleteTaskReferenceLink)
			internalProjects.GET("/tasks/:id/activities", internalProjectsRead, internalProjectH.ListTaskActivities)
		}

		// Tasks
		taskH := handlers.NewTaskHandler(s.db)
		tasks := protected.Group("/tasks")
		{
			tasks.GET("", taskH.List)
			tasks.GET("/report/pdf", taskH.ExportReportPDF)
			tasks.GET("/columns", taskH.ListColumns)
			tasks.POST("/columns", taskH.CreateColumn)
			tasks.PATCH("/columns/reorder", taskH.ReorderColumns)
			tasks.PUT("/columns/:id", taskH.UpdateColumn)
			tasks.DELETE("/columns/:id", taskH.DeleteColumn)
			tasks.POST("", taskH.Create)
			tasks.GET("/:id", taskH.Get)
			tasks.PUT("/:id", taskH.Update)
			tasks.PATCH("/:id/status", taskH.UpdateStatus)
			tasks.PATCH("/:id/kanban", taskH.MoveKanbanTask)
			tasks.DELETE("/:id", taskH.Delete)
		}

		// Leads
		leadH := handlers.NewLeadHandler(s.db)
		leads := protected.Group("/leads")
		{
			leads.GET("", leadH.List)
			leads.POST("", leadH.Create)
			leads.GET("/:id", leadH.Get)
			leads.PUT("/:id", leadH.Update)
			leads.PATCH("/:id/status", leadH.UpdateStatus)
			leads.DELETE("/:id", leadH.Delete)
			leads.POST("/:id/convert", leadH.ConvertToClient)
			leads.POST("/:id/rollback", leadH.RollbackConversion)
			leads.GET("/:id/quotations", leadH.GetQuotations)
		}

		// Invoices
		invoiceH := handlers.NewInvoiceHandler(s.db)
		invoices := protected.Group("/invoices")
		{
			invoices.GET("", invoiceH.List)
			invoices.POST("", invoiceH.Create)
			invoices.GET("/summary", invoiceH.Summary)
			invoices.GET("/:id", invoiceH.Get)
			invoices.GET("/:id/pdf", invoiceH.ExportPDF)
			invoices.PUT("/:id", invoiceH.Update)
			invoices.DELETE("/:id", invoiceH.Delete)
			invoices.POST("/:id/payments", invoiceH.AddPayment)
			invoices.DELETE("/:id/payments/:paymentId", invoiceH.DeletePayment)
			invoices.POST("/:id/items", invoiceH.AddItem)
			invoices.PUT("/:id/items/:itemId", invoiceH.UpdateItem)
			invoices.DELETE("/:id/items/:itemId", invoiceH.DeleteItem)
		}

		// Payments
		paymentH := handlers.NewPaymentHandler(s.db)
		protected.GET("/payments", paymentH.List)
		protected.GET("/payments/:id", paymentH.Get)
		protected.DELETE("/payments/:id", middleware.AdminRequired(), paymentH.Delete)

		// Contracts
		contractH := handlers.NewContractHandler(s.db)
		contracts := protected.Group("/contracts")
		{
			contracts.GET("", contractH.List)
			contracts.POST("", contractH.Create)
			contracts.GET("/:id", contractH.Get)
			contracts.PUT("/:id", contractH.Update)
			contracts.DELETE("/:id", contractH.Delete)
		}

		// Quotations
		quotationH := handlers.NewQuotationHandler(s.db)
		quotations := protected.Group("/quotations")
		{
			quotations.GET("", quotationH.List)
			quotations.POST("", quotationH.Create)
			quotations.GET("/:id", quotationH.Get)
			quotations.PUT("/:id", quotationH.Update)
			quotations.DELETE("/:id", quotationH.Delete)
			quotations.GET("/:id/pdf", quotationH.Print)
			quotations.POST("/:id/items", quotationH.AddItem)
			quotations.PUT("/:id/items/:itemId", quotationH.UpdateItem)
			quotations.DELETE("/:id/items/:itemId", quotationH.DeleteItem)
			quotations.POST("/:id/convert-to-invoice", quotationH.ConvertToInvoice)
			quotations.POST("/:id/convert-to-order", quotationH.ConvertToOrder)
			quotations.POST("/:id/convert-to-contract", quotationH.ConvertToContract)
		}

		// Items
		itemH := handlers.NewItemHandler(s.db)
		items := protected.Group("/items")
		{
			items.GET("", itemH.List)
			items.POST("", itemH.Create)
			items.PUT("/:id", itemH.Update)
			items.DELETE("/:id", itemH.Delete)
		}

		// Orders
		orderH := handlers.NewOrderHandler(s.db)
		orders := protected.Group("/orders")
		{
			orders.GET("", orderH.List)
			orders.POST("", orderH.Create)
			orders.GET("/:id", orderH.Get)
			orders.PUT("/:id", orderH.Update)
			orders.DELETE("/:id", orderH.Delete)
			orders.POST("/:id/convert-to-invoice", orderH.ConvertToInvoice)
		}

		// Events
		eventH := handlers.NewEventHandler(s.db)
		events := protected.Group("/events")
		{
			events.GET("", eventH.List)
			events.POST("", eventH.Create)
			events.GET("/:id", eventH.Get)
			events.PUT("/:id", eventH.Update)
			events.DELETE("/:id", eventH.Delete)
		}

		// Notes
		noteH := handlers.NewNoteHandler(s.db)
		notes := protected.Group("/notes")
		{
			notes.GET("", noteH.List)
			notes.POST("", noteH.Create)
			notes.PUT("/:id", noteH.Update)
			notes.DELETE("/:id", noteH.Delete)
		}

		// Expenses
		expenseH := handlers.NewExpenseHandler(s.db)
		expenses := protected.Group("/expenses")
		{
			expenses.GET("", expenseH.List)
			expenses.POST("", expenseH.Create)
			expenses.PUT("/:id", expenseH.Update)
			expenses.DELETE("/:id", expenseH.Delete)
		}

		// Assets
		assetH := handlers.NewAssetHandler(s.db)
		assets := protected.Group("/assets")
		{
			assets.GET("", assetH.List)
			assets.POST("", assetH.Create)
			assets.GET("/scan", assetH.Scan)
			assets.GET("/export", assetH.Export)
			assets.GET("/:id", assetH.Get)
			assets.PUT("/:id", assetH.Update)
			assets.DELETE("/:id", middleware.AdminRequired(), assetH.Delete)
		}
		assetMDH := handlers.NewAssetMasterDataHandler(s.db)
		assetMD := protected.Group("/asset-settings")
		{
			assetMD.GET("", assetMDH.List)
			assetMD.POST("", assetMDH.Create)
			assetMD.PUT("/:id", assetMDH.Update)
			assetMD.DELETE("/:id", middleware.AdminRequired(), assetMDH.Delete)
		}

		// Team
		teamH := handlers.NewTeamHandler(s.db)
		team := protected.Group("/team")
		{
			team.GET("/members", teamH.ListMembers)
			team.GET("/members/:id", teamH.GetMember)
			team.POST("/members", middleware.AdminRequired(), teamH.CreateMember)
			team.PUT("/members/:id", middleware.AdminRequired(), teamH.UpdateMember)
			team.PATCH("/members/:id/status", middleware.AdminRequired(), teamH.UpdateMemberStatus)
			team.DELETE("/members/:id", middleware.AdminRequired(), teamH.DeleteMember)
			team.POST("/members/:id/reset-password", middleware.AdminRequired(), teamH.ResetPassword)
			team.GET("/timecards", teamH.ListTimeCards)
			team.POST("/timecards/clock-in", teamH.ClockIn)
			team.POST("/timecards/clock-out", teamH.ClockOut)
			team.GET("/leaves", teamH.ListLeaves)
			team.POST("/leaves", teamH.ApplyLeave)
			team.PATCH("/leaves/:id/status", teamH.UpdateLeaveStatus)
			team.DELETE("/leaves/:id", teamH.DeleteLeave)
			team.GET("/announcements", teamH.ListAnnouncements)
			team.POST("/announcements", teamH.CreateAnnouncement)
		}

		// Files
		fileH := handlers.NewFileHandler(s.db, s.cfg.UploadDir)
		files := protected.Group("/files")
		{
			files.GET("", fileH.List)
			files.POST("/upload", fileH.Upload)
			files.POST("/folder", fileH.CreateFolder)
			files.GET("/:id/download", fileH.Download)
			files.DELETE("/:id", fileH.Delete)
			files.PATCH("/:id/favorite", fileH.ToggleFavorite)
		}

		// Todo
		todoH := handlers.NewTodoHandler(s.db)
		todos := protected.Group("/todos")
		{
			todos.GET("", todoH.List)
			todos.POST("", todoH.Create)
			todos.PATCH("/:id/done", todoH.MarkDone)
			todos.DELETE("/:id", todoH.Delete)
		}

		// Internal Messages & Presence
		messageH := handlers.NewMessageHandler(s.db)
		protected.POST("/presence/heartbeat", messageH.Heartbeat)
		messages := protected.Group("/messages")
		{
			messages.GET("/users", messageH.ListUsers)
			messages.GET("/conversations", messageH.ListConversations)
			messages.POST("/conversations/direct", messageH.GetOrCreateDirectConversation)
			messages.GET("/conversations/:id/messages", messageH.ListMessages)
			messages.POST("/conversations/:id/messages", messageH.SendMessage)
			messages.POST("/conversations/:id/read", messageH.MarkRead)
		}

		// Reports
		reportH := handlers.NewReportHandler(s.db)
		reports := protected.Group("/reports")
		{
			reports.GET("/invoices-summary", reportH.InvoicesSummary)
			reports.GET("/projects-summary", reportH.ProjectsSummary)
			reports.GET("/leads-summary", reportH.LeadsSummary)
			reports.GET("/expenses-summary", reportH.ExpensesSummary)
			reports.GET("/export", reportH.ExportCSV)
		}

		// App Roles (admin only for CUD, all for list)
		roleH := handlers.NewAppRoleHandler(s.db)
		roles := protected.Group("/roles")
		{
			roles.GET("", roleH.List)
			roles.POST("", middleware.AdminRequired(), roleH.Create)
			roles.GET("/:id", middleware.AdminRequired(), roleH.Get)
			roles.PUT("/:id", middleware.AdminRequired(), roleH.Update)
			roles.DELETE("/:id", middleware.AdminRequired(), roleH.Delete)
			roles.PUT("/:id/permissions", middleware.AdminRequired(), roleH.SetPermissions)
		}

		// Audit Logs (admin only)
		auditH := handlers.NewAuditLogHandler(s.db)
		protected.GET("/audit-logs", middleware.AdminRequired(), auditH.List)

		// Labels
		labelH := handlers.NewLabelHandler(s.db)
		protected.GET("/labels", labelH.List)
		protected.POST("/labels", labelH.Create)
		protected.DELETE("/labels/:id", labelH.Delete)
	}
}
