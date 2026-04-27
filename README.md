# NEXONE The All About Tool

Full-stack clone of NEXONEß built with:
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Redux Toolkit
- **Backend**: Golang (Gin) + GORM + PostgreSQL
- **Auth**: JWT
- **DevOps**: Docker Compose

---

## 📁 Project Structureß

```
cbqa/
├── cbqa-backend/          # Golang REST API
│   ├── cmd/api/           # Entry point
│   ├── internal/
│   │   ├── config/        # Environment config
│   │   ├── database/      # DB connection + migrations
│   │   ├── handlers/      # HTTP handlers (controllers)
│   │   ├── middleware/     # JWT auth, CORS
│   │   ├── models/        # GORM models
│   │   └── server/        # Router setup
│   └── Dockerfile
│
├── cbqa-frontend/         # React + Vite SPA
│   ├── src/
│   │   ├── components/    # Layout + common components
│   │   ├── pages/         # All app pages
│   │   ├── services/      # Axios API calls
│   │   ├── store/         # Redux store + slices
│   │   └── types/         # TypeScript types
│   ├── Dockerfile
│   └── nginx.conf
│
└── docker-compose.yml     # Full stack orchestration
```

---

## 🚀 Quick Start with Docker

### Prerequisites
- Docker & Docker Compose installed

### Steps

```bash
# 1. Clone both repos into same folder
mkdir cbqa && cd cbqa
git clone <backend-repo> cbqa-backend
git clone <frontend-repo> cbqa-frontend

# 2. Copy and configure environment
cp .env.example .env
# Edit .env and change JWT_SECRET

# 3. Start everything
docker-compose up -d

# 4. Access the app
# Frontend:  http://localhost:3000
# Backend:   http://localhost:8080
# pgAdmin:   http://localhost:5050  (run with: docker-compose --profile tools up -d)
```

---

## 🔧 Local Development (without Docker)

### Backend
```bash
cd cbqa-backend

# Install dependencies
go mod download

# Copy env
cp .env.example .env
# Edit .env with your local PostgreSQL settings

# Run
go run ./cmd/api

# Backend runs on http://localhost:8080
```

### Frontend
```bash
cd cbqa-frontend

# Install dependencies
npm install

# Copy env
echo "VITE_API_URL=http://localhost:8080/api/v1" > .env.local

# Run dev server
npm run dev

# Frontend runs on http://localhost:3000
```

---

## 🔑 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/register` | Register |
| GET | `/api/v1/auth/me` | Get current user |
| POST | `/api/v1/auth/logout` | Logout |

### Core Resources
All protected endpoints require `Authorization: Bearer <token>` header.

| Resource | Base Path | Methods |
|----------|-----------|---------|
| Dashboard | `/api/v1/dashboard` | GET |
| Clients | `/api/v1/clients` | GET, POST, PUT, DELETE |
| Projects | `/api/v1/projects` | GET, POST, PUT, DELETE |
| Tasks | `/api/v1/tasks` | GET, POST, PUT, PATCH, DELETE |
| Leads | `/api/v1/leads` | GET, POST, PUT, PATCH, DELETE |
| Invoices | `/api/v1/invoices` | GET, POST, PUT, DELETE |
| Payments | `/api/v1/payments` | GET |
| Contracts | `/api/v1/contracts` | GET, POST, PUT, DELETE |
| Events | `/api/v1/events` | GET, POST, PUT, DELETE |
| Team | `/api/v1/team/members` | GET, PUT |
| Time Cards | `/api/v1/team/timecards` | GET, POST (clock-in/out) |
| Leaves | `/api/v1/team/leaves` | GET, POST, PATCH |
| Expenses | `/api/v1/expenses` | GET, POST, PUT, DELETE |
| Files | `/api/v1/files` | GET, POST, DELETE |
| Todos | `/api/v1/todos` | GET, POST, PATCH, DELETE |
| Reports | `/api/v1/reports/*` | GET |

---

## 🗄️ Database

The app uses **PostgreSQL** with GORM auto-migration. All tables are created automatically on startup.

### Key Tables
- `users` — Team members & authentication
- `clients` — Client companies/persons
- `projects` — Audit projects
- `tasks` — Project tasks
- `leads` — Sales pipeline
- `invoices` — Billing
- `payments` — Payment records
- `contracts` — Client contracts
- `events` — Calendar events
- `time_cards` — Attendance tracking
- `leaves` — Leave requests
- `expenses` — Expense tracking
- `files` — File manager
- `todos` — Personal to-do lists

---

## 🏗️ Pages

| Page | Route | Features |
|------|-------|---------|
| Login | `/login` | JWT auth |
| Dashboard | `/dashboard` | Stats, charts, task list |
| Events | `/events` | Calendar (month/week/day) |
| Clients | `/clients` | List, CRUD, contacts |
| Projects | `/projects` | Table, CRUD, progress |
| Tasks | `/tasks` | List + Kanban + Gantt |
| Leads | `/leads` | List + Kanban pipeline |
| Invoices | `/sales/invoices` | Full billing management |
| Store | `/sales/store` | Product catalog |
| Payments | `/sales/payments` | Payment history |
| Team | `/team/members` | Staff directory |
| Time Cards | `/team/timecards` | Clock in/out |
| Leave | `/team/leave` | Leave management |
| Files | `/files` | File manager |
| Expenses | `/expenses` | Expense tracking |
| Reports | `/reports` | Invoice + project reports |
| To Do | `/todo` | Personal task list |

---

## 🔒 Security Notes

1. Change `JWT_SECRET` in production — use a 32+ character random string
2. Use HTTPS in production (add SSL to nginx config)
3. Set proper CORS origins instead of `*` in production
4. Use strong database passwords

---

## 📦 Tech Stack Details

### Backend
- `gin` — HTTP framework
- `gorm` — ORM
- `golang-jwt/jwt` — JWT tokens
- `bcrypt` — Password hashing
- `postgres` driver

### Frontend
- `react` + `react-dom` — UI
- `react-router-dom` — Routing
- `@reduxjs/toolkit` — State management
- `axios` — HTTP client
- `recharts` — Charts
- `react-big-calendar` — Calendar
- `@hello-pangea/dnd` — Drag & drop
- `tailwindcss` — Styling
- `lucide-react` — Icons
- `react-toastify` — Notifications



### ENVI
Berikut info environment lengkapnya:

🗄️ Database (PostgreSQL)
Key	Value
Host	localhost (manual) / postgres (Docker)
Port	5432
Database	cbqa_db
User	cbqa
Password	cbqa123
Connection string:


postgresql://cbqa:cbqa123@localhost:5432/cbqa_db
🔧 Backend API
Key	Value
Port	8080
Base URL (local)	http://localhost:8080
Base URL (Docker)	http://localhost:8080
Health check	http://localhost:8080/health
API prefix	/api/v1
JWT secret	dev-secret-change-in-production
JWT expiry	24 jam
Upload dir	./uploads (manual) / /app/uploads (Docker)
🌐 Frontend
Key	Value
Port (dev)	3000 atau 3001
Port (Docker)	3000
API URL	/api/v1 (di-proxy Nginx)
📧 SMTP (Email)
Saat ini kosong / tidak dikonfigurasi — fitur Forgot Password tidak kirim email di lokal. Aman, tidak error.

Untuk aktifkan, isi di Backend/.env:


SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@cbqa.com
🐘 pgAdmin (opsional)
Key	Value
URL	http://localhost:5050
Email	admin@cbqa.com
Password	admin123
Jalankan dengan: docker-compose --profile tools up

👤 Login Default
Role	Email	Password
Admin	admin@cbqa.com	Admin123!
Member	fauzi@cbqa.com	Member123!

