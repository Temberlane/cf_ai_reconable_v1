#!/bin/bash

# Test script to verify D1 database creation and ID extraction

echo "🧪 Testing D1 database creation..."

# Test 1: Check if wrangler is available
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found"
    exit 1
fi

echo "✅ Wrangler CLI found"

# Test 2: Check if user is logged in
if ! wrangler whoami &> /dev/null; then
    echo "❌ Not logged in to Wrangler"
    exit 1
fi

echo "✅ Wrangler authenticated"

# Test 3: Check existing databases
echo "📋 Checking existing D1 databases..."
EXISTING_DB=$(wrangler d1 list | grep "reconable-db" || true)

if [ -n "$EXISTING_DB" ]; then
    echo "✅ Found existing database:"
    echo "$EXISTING_DB"
    
    # Extract database ID
    DB_ID=$(echo "$EXISTING_DB" | grep -o '[a-f0-9-]\{36\}' | head -1)
    if [ -n "$DB_ID" ]; then
        echo "✅ Extracted database ID: $DB_ID"
    else
        echo "❌ Could not extract database ID"
        echo "Raw output: $EXISTING_DB"
    fi
else
    echo "ℹ️  No existing database found, would create new one"
fi

# Test 4: Test database creation (dry run)
echo "🧪 Testing database creation command..."
echo "Command: wrangler d1 create reconable-db-test"

# Don't actually create, just show what would happen
echo "This would run: wrangler d1 create reconable-db-test"
echo "Expected output format examples:"
echo "  database_id = \"abc123-def456-ghi789\""
echo "  {\"database_id\":\"abc123-def456-ghi789\"}"
echo "  Database created with ID: abc123-def456-ghi789"

echo ""
echo "✅ Test completed. If you see any errors above, the setup script may need further adjustments."
