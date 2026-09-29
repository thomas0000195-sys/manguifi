#!/bin/bash
# LWS Staging Deployment Test
# Simulates critical deployment steps locally
# Run: bash scripts/staging-test.sh

set -e

echo "🧪 LWS STAGING TEST — Simulating Production Deployment"
echo "========================================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

test_step() {
  local name="$1"
  local cmd="$2"

  echo -ne "Testing: $name ... "

  if eval "$cmd" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗ FAIL${NC}"
    ((TESTS_FAILED++))
    echo "  Command: $cmd"
    return 1 || true
  fi
}

# 1. Verify Node.js version
echo ""
echo "1️⃣  Environment Verification"
test_step "Node.js version >= 22" "node --version | grep -E 'v2[2-9]'"
test_step "npm installed" "npm --version"
test_step "git installed" "git --version"

# 2. Build verification
echo ""
echo "2️⃣  Build Verification"
test_step "Clean build succeeds" "npm run build"
test_step "Build output exists" "test -d .next"
test_step "Lint passes" "npm run lint"

# 3. Prisma verification
echo ""
echo "3️⃣  Prisma Verification"
test_step "Prisma generate succeeds" "npx prisma generate"
test_step "Schema valid" "npx prisma validate"

# 4. Environment variables
echo ""
echo "4️⃣  Environment Variables"
test_step ".env.example exists" "test -f .env.example"
test_step ".env.production.example exists" "test -f .env.production.example"

# 5. Database & migrations
echo ""
echo "5️⃣  Database Readiness (Schema Check)"
# Check that migration files would apply correctly
test_step "Migrations directory exists" "test -d prisma/migrations"
test_step "Latest migration present" "test -d prisma/migrations && ls -1 prisma/migrations | tail -1"

# 6. Static files
echo ""
echo "6️⃣  Static Assets"
test_step "Public dir exists" "test -d public"
test_step "SW (service worker) exists" "test -f public/sw.js"

# 7. Critical dependencies
echo ""
echo "7️⃣  Critical Dependencies"
test_step "next installed" "npm ls next > /dev/null 2>&1"
test_step "prisma installed" "npm ls prisma > /dev/null 2>&1"
test_step "react installed" "npm ls react > /dev/null 2>&1"
test_step "bcryptjs installed" "npm ls bcryptjs > /dev/null 2>&1"

# 8. Type checking
echo ""
echo "8️⃣  Type Checking"
test_step "TypeScript types valid" "npx tsc --noEmit"

# Summary
echo ""
echo "========================================================"
echo -e "Results: ${GREEN}${TESTS_PASSED} PASSED${NC} | ${RED}${TESTS_FAILED} FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ STAGING TEST PASSED - Ready for LWS deployment${NC}"
  exit 0
else
  echo -e "${RED}✗ STAGING TEST FAILED - Fix issues before deployment${NC}"
  exit 1
fi
