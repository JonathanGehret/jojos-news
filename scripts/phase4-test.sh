#!/bin/bash
# Phase 4 Testing Script for Bash/Unix

set +e

echo "════════════════════════════════════════════════════════════"
echo "PHASE 4: EMAIL DELIVERY TESTING SUITE"
echo "════════════════════════════════════════════════════════════"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "📋 Pre-Flight Checklist:"
echo ""

# 1. Check if Docker is running
echo "Checking Docker..."
if docker-compose ps | grep -q postgres; then
    echo "✓ Docker containers are running"
else
    echo "✗ Docker containers not running. Starting..."
    echo "  Run: docker-compose up -d"
fi

echo ""

# 2. Check if backend is running
echo "Checking backend server..."
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "✓ Backend server is running"
else
    echo "✗ Backend not responding. Make sure to run: npm run dev (in backend dir)"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "Starting Phase 4 Validator..."
echo "════════════════════════════════════════════════════════════"
echo ""

# Run the validator
cd "$BACKEND_DIR"

if [ -f "node_modules/.bin/ts-node" ]; then
    ./node_modules/.bin/ts-node "../scripts/phase4-validator.ts"
else
    echo "Installing dependencies..."
    npm install --silent
    ./node_modules/.bin/ts-node "../scripts/phase4-validator.ts"
fi

cd - > /dev/null

echo ""
echo "════════════════════════════════════════════════════════════"
echo "Phase 4 Testing Complete!"
echo "════════════════════════════════════════════════════════════"
