#!/bin/bash

# Reconable Lite+ Setup Script (Web Scraping Version)
# This script helps set up the required Cloudflare resources for web scraping

set -e

echo "🚀 Setting up Reconable Lite+ (Web Scraping Version)..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Please install it first:"
    echo "   npm install -g wrangler"
    exit 1
fi

# Check if user is logged in
if ! wrangler whoami &> /dev/null; then
    echo "❌ Not logged in to Wrangler. Please run:"
    echo "   wrangler login"
    exit 1
fi

echo "✅ Wrangler CLI found and authenticated"

# Check if D1 database already exists
echo "📊 Checking for existing D1 database..."
EXISTING_DB=$(wrangler d1 list | grep "reconable-db" || true)

if [ -n "$EXISTING_DB" ]; then
    echo "✅ D1 database 'reconable-db' already exists"
    # Extract database ID from existing database
    DB_ID=$(echo "$EXISTING_DB" | grep -o '[a-f0-9-]\{36\}' | head -1)
    if [ -n "$DB_ID" ]; then
        echo "✅ Found existing database ID: $DB_ID"
    else
        echo "⚠️  Could not extract database ID from existing database"
        echo "Please check your D1 databases: wrangler d1 list"
        exit 1
    fi
else
    # Create D1 database
    echo "📊 Creating D1 database..."
    DB_OUTPUT=$(wrangler d1 create reconable-db 2>&1)
    echo "D1 creation output: $DB_OUTPUT"

    # Try multiple patterns to extract database ID
    DB_ID=$(echo "$DB_OUTPUT" | grep -o 'database_id = "[^"]*"' | cut -d'"' -f2)

    # If that didn't work, try alternative patterns
    if [ -z "$DB_ID" ]; then
        DB_ID=$(echo "$DB_OUTPUT" | grep -o '"database_id":"[^"]*"' | cut -d'"' -f4)
    fi

    # If still no ID, try JSON parsing
    if [ -z "$DB_ID" ]; then
        DB_ID=$(echo "$DB_OUTPUT" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    fi

    # If still no ID, try the last line approach
    if [ -z "$DB_ID" ]; then
        DB_ID=$(echo "$DB_OUTPUT" | tail -1 | grep -o '[a-f0-9-]\{36\}' | head -1)
    fi

    if [ -z "$DB_ID" ]; then
        echo "❌ Failed to create D1 database or extract database ID"
        echo "Raw output: $DB_OUTPUT"
        echo ""
        echo "Please try creating the database manually:"
        echo "  wrangler d1 create reconable-db"
        echo "Then update wrangler.jsonc with the database ID"
        exit 1
    fi

    echo "✅ D1 database created with ID: $DB_ID"
fi

# Check if Vectorize index already exists
echo "🔍 Checking for existing Vectorize index..."
EXISTING_VECTORIZE=$(wrangler vectorize list | grep "reconable-embeddings" || true)

if [ -n "$EXISTING_VECTORIZE" ]; then
    echo "✅ Vectorize index 'reconable-embeddings' already exists"
else
    # Create Vectorize index
    echo "🔍 Creating Vectorize index..."
    VECTORIZE_OUTPUT=$(wrangler vectorize create reconable-embeddings --dimensions=768 --metric=cosine 2>&1)
    VECTORIZE_EXIT_CODE=$?

    echo "Vectorize creation output: $VECTORIZE_OUTPUT"

    if [ $VECTORIZE_EXIT_CODE -ne 0 ]; then
        echo "❌ Failed to create Vectorize index"
        echo "Raw output: $VECTORIZE_OUTPUT"
        echo ""
        echo "Please try creating the Vectorize index manually:"
        echo "  wrangler vectorize create reconable-embeddings --dimensions=768 --metric=cosine"
        echo "Then update wrangler.jsonc with the index name"
        exit 1
    fi

    echo "✅ Vectorize index created"
fi

# Initialize database schema
echo "📋 Initializing database schema..."
SCHEMA_OUTPUT=$(wrangler d1 execute reconable-db --file=./schema.sql 2>&1)
SCHEMA_EXIT_CODE=$?

echo "Schema initialization output: $SCHEMA_OUTPUT"

if [ $SCHEMA_EXIT_CODE -eq 0 ]; then
    echo "✅ Database schema initialized"
else
    echo "❌ Failed to initialize database schema"
    echo "Raw output: $SCHEMA_OUTPUT"
    echo ""
    echo "Please try initializing the schema manually:"
    echo "  wrangler d1 execute reconable-db --file=./schema.sql"
    exit 1
fi

# Update wrangler.jsonc with actual database ID if needed
echo "⚙️  Checking wrangler.jsonc configuration..."
if grep -q "your-d1-database-id" wrangler.jsonc; then
    echo "📝 Updating wrangler.jsonc with database ID..."
    sed -i.bak "s/your-d1-database-id/$DB_ID/g" wrangler.jsonc
    rm wrangler.jsonc.bak
    echo "✅ Configuration updated"
else
    echo "✅ wrangler.jsonc already configured"
fi

# Prompt for Brightdata API token
echo ""
echo "🔑 Brightdata API Setup Required:"
echo "1. Go to https://brightdata.com/"
echo "2. Sign up for an account and get your API token"
echo "3. Create a dataset for LinkedIn scraping"
echo "4. Copy your API token"
echo ""

read -p "Enter your Brightdata API Token: " BRIGHTDATA_API_TOKEN

# Set Brightdata API token as secret
echo "🔑 Setting Brightdata API token..."
echo "$BRIGHTDATA_API_TOKEN" | wrangler secret put BRIGHTDATA_API_TOKEN

echo "✅ Brightdata API token configured"

# Deploy the application
echo "🚀 Deploying application..."
wrangler deploy

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Reconable Lite+ deployed successfully!"
    echo ""
    echo "📋 What's New in Web Scraping Version:"
    echo "✅ No OAuth setup required"
    echo "✅ No LinkedIn API credentials needed"
    echo "✅ Automatic web scraping of public data"
    echo "✅ Enhanced privacy and compliance"
    echo ""
    echo "🔗 Your app is available at:"
    echo "   https://reconable-lite-plus.temberlane195.workers.dev"
    echo ""
    echo "📚 How to Use:"
    echo "1. Visit the deployed URL"
    echo "2. Enter a subject name (person or company)"
    echo "3. Click 'Start Analysis'"
    echo "4. Monitor progress and get the report"
    echo ""
    echo "🔒 Privacy & Ethics:"
    echo "• Only public data is collected"
    echo "• Respects robots.txt and rate limits"
    echo "• Automatically redacts sensitive information"
    echo "• Designed for legitimate research purposes"
    echo ""
    echo "📖 For more information, see:"
    echo "   - README_RECONABLE_LITE_PLUS.md"
    echo "   - ARCHITECTURE_REWRITE_SUMMARY.md"
else
    echo "❌ Deployment failed"
    exit 1
fi