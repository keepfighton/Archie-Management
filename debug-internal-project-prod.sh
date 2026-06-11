#!/bin/bash

# Script untuk debugging Internal Project Production Issue
# Usage: ./debug-internal-project-prod.sh

echo "=== NEXONE Internal Project Debug Script ==="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}1. Checking if backend container is running...${NC}"
docker ps | grep nexone.*backend || echo -e "${RED}❌ Backend container not found${NC}"
echo ""

echo -e "${YELLOW}2. Checking backend logs for errors...${NC}"
docker logs nexone-backend --tail 50 | grep -i "error\|panic\|fatal" || echo -e "${GREEN}✓ No errors in recent logs${NC}"
echo ""

echo -e "${YELLOW}3. Testing API health endpoint...${NC}"
curl -s https://nexone.nexoratech.co/health | jq '.' || echo -e "${RED}❌ Health check failed${NC}"
echo ""

echo -e "${YELLOW}4. Checking database connection...${NC}"
docker exec nexone-postgres psql -U cbqa -d cbqa_db -c "SELECT COUNT(*) as project_count FROM internal_projects WHERE deleted_at IS NULL;" 2>&1
echo ""

echo -e "${YELLOW}5. Checking project #1 data...${NC}"
docker exec nexone-postgres psql -U cbqa -d cbqa_db -c "
SELECT
  ip.id,
  ip.name,
  ip.owner_id,
  u.name as owner_name,
  (SELECT COUNT(*) FROM internal_project_columns WHERE project_id = ip.id AND deleted_at IS NULL) as columns_count,
  (SELECT COUNT(*) FROM internal_tasks WHERE project_id = ip.id AND deleted_at IS NULL) as tasks_count,
  (SELECT COUNT(*) FROM internal_project_members WHERE project_id = ip.id AND deleted_at IS NULL) as members_count
FROM internal_projects ip
LEFT JOIN users u ON u.id = ip.owner_id
WHERE ip.id = 1 AND ip.deleted_at IS NULL;
" 2>&1
echo ""

echo -e "${YELLOW}6. Testing API endpoint directly (requires login token)...${NC}"
echo "Please run this command manually with a valid token:"
echo ""
echo -e "${GREEN}curl -H 'Authorization: Bearer YOUR_TOKEN' https://nexone.nexoratech.co/api/v1/internal-projects/1 | jq '.'${NC}"
echo ""

echo -e "${YELLOW}7. Checking frontend build date...${NC}"
docker exec nexone-frontend ls -lh /usr/share/nginx/html/index.html 2>&1 | awk '{print $6, $7, $8, $9}'
echo ""

echo -e "${YELLOW}8. Checking nginx error logs...${NC}"
docker exec nexone-frontend tail -n 20 /var/log/nginx/error.log 2>&1 || echo -e "${GREEN}✓ No nginx errors${NC}"
echo ""

echo "=== Debug script completed ==="
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Share the output above"
echo "2. Or check browser console at: https://nexone.nexoratech.co/internal-project/projects/1"
echo "3. Press F12 → Console tab, screenshot any errors"
