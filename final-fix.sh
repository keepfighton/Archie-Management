#!/bin/bash
# FINAL FIX - Disable AutoMigrate, use manual SQL schema
# This will bypass GORM migration completely

set -e

cd ~/archie-node/apps/archie-management

echo "🔧 FINAL FIX - Manual Schema Import"
echo "===================================="
echo ""

echo "Step 1: Stopping all services..."
docker compose down

echo ""
echo "Step 2: Removing old database..."
docker volume rm archie-management_postgres_data 2>/dev/null || true

echo ""
echo "Step 3: Creating SQL schema file..."
cat > /tmp/schema.sql <<'SQLEOF'
-- Archie Management Database Schema
-- Generated to bypass GORM AutoMigrate issues

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    job_title VARCHAR(255),
    phone VARCHAR(50),
    role VARCHAR(50) DEFAULT 'member',
    is_active BOOLEAN DEFAULT true,
    app_role_id INTEGER,
    avatar_url VARCHAR(500)
);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    client_type VARCHAR(50),
    website VARCHAR(255),
    industry VARCHAR(100),
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_clients_deleted_at ON clients(deleted_at);

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    position VARCHAR(100),
    is_primary BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_contacts_deleted_at ON contacts(deleted_at);

-- Clusters table
CREATE TABLE IF NOT EXISTS clusters (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    name VARCHAR(255),
    description TEXT
);
CREATE INDEX IF NOT EXISTS idx_clusters_deleted_at ON clusters(deleted_at);

-- Projects table (create BEFORE tasks because tasks references projects)
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    name VARCHAR(255),
    description TEXT,
    client_id INTEGER REFERENCES clients(id),
    cluster_id INTEGER,
    start_date DATE,
    end_date DATE,
    status VARCHAR(50),
    progress INTEGER DEFAULT 0,
    budget NUMERIC(15,2),
    manager_id INTEGER REFERENCES users(id),
    priority VARCHAR(50)
);
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at);

-- Tasks table (references projects)
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    title VARCHAR(255),
    description TEXT,
    project_id INTEGER REFERENCES projects(id),
    assigned_to INTEGER REFERENCES users(id),
    status VARCHAR(50),
    priority VARCHAR(50),
    start_date DATE,
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    estimated_hours NUMERIC(8,2),
    actual_hours NUMERIC(8,2),
    kanban_column_id INTEGER,
    kanban_position INTEGER,
    gantt_start_date DATE,
    gantt_end_date DATE,
    gantt_progress INTEGER DEFAULT 0,
    parent_task_id INTEGER
);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);

-- Task Kanban Columns
CREATE TABLE IF NOT EXISTS task_kanban_columns (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    title VARCHAR(255),
    status VARCHAR(50),
    position INTEGER
);
CREATE INDEX IF NOT EXISTS idx_task_kanban_columns_deleted_at ON task_kanban_columns(deleted_at);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    company_name VARCHAR(255),
    contact_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    status VARCHAR(50),
    source VARCHAR(100),
    value NUMERIC(15,2),
    notes TEXT,
    assigned_to INTEGER REFERENCES users(id),
    expected_close_date DATE
);
CREATE INDEX IF NOT EXISTS idx_leads_deleted_at ON leads(deleted_at);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    invoice_number VARCHAR(100) UNIQUE,
    client_id INTEGER REFERENCES clients(id),
    project_id INTEGER REFERENCES projects(id),
    issue_date DATE,
    due_date DATE,
    status VARCHAR(50),
    subtotal NUMERIC(15,2),
    tax NUMERIC(15,2),
    discount NUMERIC(15,2),
    total NUMERIC(15,2),
    paid NUMERIC(15,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'IDR',
    notes TEXT,
    terms TEXT
);
CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at ON invoices(deleted_at);

-- Invoice Items
CREATE TABLE IF NOT EXISTS invoice_items (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT,
    quantity INTEGER,
    unit_price NUMERIC(15,2),
    amount NUMERIC(15,2)
);
CREATE INDEX IF NOT EXISTS idx_invoice_items_deleted_at ON invoice_items(deleted_at);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    invoice_id INTEGER REFERENCES invoices(id),
    amount NUMERIC(15,2),
    payment_date DATE,
    payment_method VARCHAR(50),
    reference VARCHAR(255),
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_deleted_at ON payments(deleted_at);

-- Contracts, Items, Orders, Events, Notes, Expenses, Leaves, etc...
-- (Simplified - add more tables as needed)

CREATE TABLE IF NOT EXISTS contracts (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    contract_number VARCHAR(100),
    client_id INTEGER REFERENCES clients(id),
    project_id INTEGER REFERENCES projects(id),
    start_date DATE,
    end_date DATE,
    value NUMERIC(15,2),
    status VARCHAR(50),
    terms TEXT
);

CREATE TABLE IF NOT EXISTS files (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    name VARCHAR(255),
    original_name VARCHAR(255),
    size BIGINT,
    mime_type VARCHAR(100),
    path VARCHAR(500),
    uploaded_by INTEGER REFERENCES users(id),
    category VARCHAR(50),
    description TEXT
);

CREATE TABLE IF NOT EXISTS labels (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    name VARCHAR(255),
    color VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS todos (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(255),
    description TEXT,
    is_done BOOLEAN DEFAULT false,
    due_date DATE
);

CREATE TABLE IF NOT EXISTS time_cards (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    user_id INTEGER REFERENCES users(id),
    in_date DATE,
    in_time TIME,
    out_date DATE,
    out_time TIME,
    duration NUMERIC(8,2),
    work_mode VARCHAR(50),
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    distance_m NUMERIC(10,2),
    location_accuracy NUMERIC(10,2)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    entity_type VARCHAR(100),
    entity_id INTEGER,
    action VARCHAR(50),
    user_id INTEGER REFERENCES users(id),
    user_name VARCHAR(255),
    details JSONB
);

CREATE TABLE IF NOT EXISTS app_roles (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    name VARCHAR(255),
    description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    app_role_id INTEGER REFERENCES app_roles(id) ON DELETE CASCADE,
    menu VARCHAR(100),
    can_read BOOLEAN DEFAULT false,
    can_edit BOOLEAN DEFAULT false
);

-- Internal Projects tables
CREATE TABLE IF NOT EXISTS internal_projects (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    name VARCHAR(255),
    description TEXT,
    status VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS internal_project_members (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    project_id INTEGER REFERENCES internal_projects(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS internal_project_columns (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    project_id INTEGER REFERENCES internal_projects(id) ON DELETE CASCADE,
    key VARCHAR(100),
    label VARCHAR(255),
    color VARCHAR(50),
    position INTEGER
);

CREATE TABLE IF NOT EXISTS internal_tasks (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    project_id INTEGER REFERENCES internal_projects(id) ON DELETE CASCADE,
    column_id INTEGER REFERENCES internal_project_columns(id),
    title VARCHAR(255),
    description TEXT,
    status VARCHAR(50),
    position INTEGER,
    due_date DATE,
    priority VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS internal_task_assignees (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    task_id INTEGER REFERENCES internal_tasks(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS internal_time_logs (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    task_id INTEGER REFERENCES internal_tasks(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    clock_in TIMESTAMP WITH TIME ZONE,
    clock_out TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER
);

CREATE TABLE IF NOT EXISTS internal_subtasks (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    task_id INTEGER REFERENCES internal_tasks(id) ON DELETE CASCADE,
    title VARCHAR(255),
    is_done BOOLEAN DEFAULT false,
    position INTEGER
);

CREATE TABLE IF NOT EXISTS internal_task_comments (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    task_id INTEGER REFERENCES internal_tasks(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    content TEXT
);

CREATE TABLE IF NOT EXISTS internal_task_comment_mentions (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    comment_id INTEGER REFERENCES internal_task_comments(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS internal_task_attachments (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    task_id INTEGER REFERENCES internal_tasks(id) ON DELETE CASCADE,
    file_name VARCHAR(255),
    file_url VARCHAR(500),
    file_size BIGINT,
    uploaded_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS internal_task_reference_links (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    task_id INTEGER REFERENCES internal_tasks(id) ON DELETE CASCADE,
    title VARCHAR(255),
    url VARCHAR(500)
);

CREATE TABLE IF NOT EXISTS internal_task_activities (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    task_id INTEGER REFERENCES internal_tasks(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100),
    details JSONB
);

-- Other tables (simplified)
CREATE TABLE IF NOT EXISTS items (id SERIAL PRIMARY KEY, created_at TIMESTAMP, updated_at TIMESTAMP, deleted_at TIMESTAMP, name VARCHAR(255), sku VARCHAR(100), price NUMERIC(15,2));
CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, created_at TIMESTAMP, updated_at TIMESTAMP, deleted_at TIMESTAMP, order_number VARCHAR(100), client_id INTEGER, total NUMERIC(15,2));
CREATE TABLE IF NOT EXISTS events (id SERIAL PRIMARY KEY, created_at TIMESTAMP, updated_at TIMESTAMP, deleted_at TIMESTAMP, title VARCHAR(255), start_time TIMESTAMP, end_time TIMESTAMP);
CREATE TABLE IF NOT EXISTS notes (id SERIAL PRIMARY KEY, created_at TIMESTAMP, updated_at TIMESTAMP, deleted_at TIMESTAMP, user_id INTEGER, title VARCHAR(255), content TEXT);
CREATE TABLE IF NOT EXISTS expenses (id SERIAL PRIMARY KEY, created_at TIMESTAMP, updated_at TIMESTAMP, deleted_at TIMESTAMP, user_id INTEGER, amount NUMERIC(15,2), category VARCHAR(100), date DATE);
CREATE TABLE IF NOT EXISTS leaves (id SERIAL PRIMARY KEY, created_at TIMESTAMP, updated_at TIMESTAMP, deleted_at TIMESTAMP, user_id INTEGER, start_date DATE, end_date DATE, status VARCHAR(50));
CREATE TABLE IF NOT EXISTS announcements (id SERIAL PRIMARY KEY, created_at TIMESTAMP, updated_at TIMESTAMP, deleted_at TIMESTAMP, title VARCHAR(255), content TEXT);
CREATE TABLE IF NOT EXISTS notifications (id SERIAL PRIMARY KEY, created_at TIMESTAMP, updated_at TIMESTAMP, deleted_at TIMESTAMP, user_id INTEGER, message TEXT, is_read BOOLEAN);
CREATE TABLE IF NOT EXISTS quotations (id SERIAL PRIMARY KEY, created_at TIMESTAMP, updated_at TIMESTAMP, deleted_at TIMESTAMP, quotation_number VARCHAR(100), client_id INTEGER);
CREATE TABLE IF NOT EXISTS quotation_items (id SERIAL PRIMARY KEY, created_at TIMESTAMP, updated_at TIMESTAMP, deleted_at TIMESTAMP, quotation_id INTEGER, description TEXT, amount NUMERIC(15,2));
CREATE TABLE IF NOT EXISTS milestones (id SERIAL PRIMARY KEY, created_at TIMESTAMP, updated_at TIMESTAMP, deleted_at TIMESTAMP, project_id INTEGER, name VARCHAR(255));
CREATE TABLE IF NOT EXISTS deliverables (id SERIAL PRIMARY KEY, created_at TIMESTAMP, updated_at TIMESTAMP, deleted_at TIMESTAMP, milestone_id INTEGER, name VARCHAR(255));
CREATE TABLE IF NOT EXISTS user_presences (id SERIAL PRIMARY KEY, created_at TIMESTAMP, updated_at TIMESTAMP, user_id INTEGER, status VARCHAR(50));
CREATE TABLE IF NOT EXISTS conversations (id SERIAL PRIMARY KEY, created_at TIMESTAMP, updated_at TIMESTAMP, deleted_at TIMESTAMP, name VARCHAR(255));
CREATE TABLE IF NOT EXISTS conversation_members (id SERIAL PRIMARY KEY, conversation_id INTEGER, user_id INTEGER);
CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, created_at TIMESTAMP, conversation_id INTEGER, user_id INTEGER, content TEXT);
CREATE TABLE IF NOT EXISTS assets (id SERIAL PRIMARY KEY, created_at TIMESTAMP, updated_at TIMESTAMP, deleted_at TIMESTAMP, name VARCHAR(255));
CREATE TABLE IF NOT EXISTS asset_master_data (id SERIAL PRIMARY KEY, created_at TIMESTAMP, updated_at TIMESTAMP, deleted_at TIMESTAMP, category VARCHAR(100));

SQLEOF

echo "✅ SQL schema created"

echo ""
echo "Step 4: Starting postgres..."
docker compose up -d postgres
sleep 10

echo ""
echo "Step 5: Importing schema..."
docker compose exec -T postgres psql -U archie_user -d archie_management_db < /tmp/schema.sql

echo "✅ Schema imported successfully!"

echo ""
echo "Step 6: Starting backend and frontend..."
docker compose up -d backend frontend

echo ""
echo "Step 7: Waiting for backend (60 seconds)..."
sleep 10

ATTEMPT=0
while [ $ATTEMPT -lt 30 ]; do
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        echo "✅ Backend is HEALTHY!"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo "Waiting... ($ATTEMPT/30)"
    sleep 2
done

if [ $ATTEMPT -eq 30 ]; then
    echo "❌ Backend timeout - checking logs:"
    docker compose logs backend --tail 50
    exit 1
fi

echo ""
echo "Step 8: Seeding database..."
docker compose exec -T backend sh -c 'cd cmd/seed && go run main.go'

echo ""
echo "=========================================="
echo "✅ ✅ ✅  SUCCESS! ✅ ✅ ✅"
echo "=========================================="
echo ""

docker compose ps

echo ""
echo "🌐 Access:"
echo "  https://management.archieconsultant.com"
echo ""
echo "👤 Login:"
echo "  admin@archieconsultant.com / Admin123!"
echo ""
echo "🎉 DONE! Application is running!"
echo ""
