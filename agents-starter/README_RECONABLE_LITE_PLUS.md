# Reconable Lite+

A stateful, memory-first multi-agent pipeline demonstrating the power of Cloudflare's Agent Development Kit (ADK) with LinkedIn OAuth integration for user-consented data collection and analysis.

## 🎯 Project Goals

- **Showcase Cloudflare ADK Value**: Demonstrate genuine value beyond simple "scrape + GPT" approaches
- **Memory-First Architecture**: Use Durable Objects for orchestration, Vectorize for semantic memory, D1 for canonical facts, and KV/R2 for raw evidence
- **User Consent Management**: Implement 3-legged OAuth with LinkedIn for explicit user consent
- **Compliance-First Design**: Enforce consent with a Compliance Agent that gates LinkedIn tools
- **Production-Ready UI**: Provide a complete web interface for analysis runs and report generation

## 🏗️ Architecture

### Core Components

- **SubjectOrchestrator (DO)**: State machine managing the analysis pipeline
- **UserSessionDO (DO)**: Manages user authentication and consent
- **HarvesterAgent**: Collects evidence from various sources
- **ComplianceAgent**: Enforces consent requirements and privacy policies
- **CanonicalMemory**: D1 database for structured facts and claims
- **VectorMemory**: Vectorize for semantic search and similarity

### Data Flow

```
User Request → OAuth Flow → Consent Verification → Evidence Collection → 
AI Extraction → Compliance Verification → Memory Storage → Report Synthesis
```

## 🛠️ Technology Stack

- **Cloudflare Workers** - Serverless compute
- **Durable Objects** - Stateful orchestration and user sessions
- **Vectorize** - Semantic memory and similarity search
- **D1 Database** - Canonical facts and structured data
- **Workers KV** - OAuth state and raw evidence
- **Workers AI (Llama 3.3)** - Extraction, verification, and synthesis
- **Browser Rendering** - Web content collection
- **LinkedIn API** - User-consented profile data

## 🔐 OAuth Flow

### Endpoints

- `GET /oauth/linkedin/start` → Redirect to LinkedIn authorization
- `GET /oauth/linkedin/callback` → Exchange code for tokens, store in UserSessionDO

### Scopes

- `r_liteprofile` - Basic profile information
- `r_emailaddress` - Email address access

### LinkedIn API Usage

- `GET https://api.linkedin.com/v2/me` - Profile data
- `GET https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))` - Email data

## 📊 Data Schemas

### Evidence JSON
```json
{
  "id": "evid_...",
  "subject_id": "subj_...",
  "source_url": "linkedin://me",
  "collected_at": "2025-09-29T00:00:00Z",
  "content_text": "raw text or JSON stringified",
  "content_type": "json|html|text",
  "hash": "sha256...",
  "extraction": {
    "entities": [{ "type": "person", "name": "<Name>" }],
    "claims": [{ "predicate": "works_at", "object": "<Org>", "confidence": 0.85 }]
  }
}
```

### Claims D1 Schema
```sql
CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  predicate TEXT NOT NULL,
  object TEXT NOT NULL,
  confidence REAL NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_verified_at TEXT NOT NULL,
  provenance_json TEXT NOT NULL,
  policy_tags TEXT NOT NULL
);
```

## 🤖 Agent State Machine

### Orchestrator States

1. **INTAKE** - Record subject and consent flags
2. **DISCOVER** - Find available sources
3. **FETCH** - Collect evidence with retries/limits
4. **NORMALIZE** - Unify to Evidence JSON format
5. **EXTRACT** - AI-powered claim extraction
6. **VERIFY** - Compliance agent gating/redaction
7. **UPSERT** - Store in D1 + Vectorize
8. **SYNTHESIZE** - Generate comprehensive report
9. **PUBLISH** - Return JSON/HTML report

### API Endpoints

- `POST /api/run {subject, userId}` - Start analysis
- `GET /api/run/:id/status` - Check run status
- `GET /api/run/:id/report` - Get final report
- `GET /api/me?userId=...` - User session info
- `POST /api/revoke {userId}` - Revoke LinkedIn access

## 🔧 Setup Instructions

### 1. Prerequisites

```bash
npm install -g wrangler
npm install
```

### 2. Create Required Resources

#### D1 Database
```bash
wrangler d1 create reconable-db
```

#### Vectorize Index
```bash
wrangler vectorize create reconable-embeddings --dimensions=768 --metric=cosine
```

#### LinkedIn App
1. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/)
2. Create new app
3. Add redirect URI: `https://your-domain.workers.dev/oauth/linkedin/callback`
4. Note Client ID and Client Secret

### 3. Configure Environment

Update `wrangler.jsonc`:
```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "reconable-db",
      "database_id": "your-actual-d1-database-id"
    }
  ],
  "vectorize": [
    {
      "binding": "VECTORIZE_INDEX",
      "index_name": "reconable-embeddings"
    }
  ],
  "vars": {
    "LINKEDIN_CLIENT_ID": "your-linkedin-client-id",
    "LINKEDIN_REDIRECT_URI": "https://your-domain.workers.dev/oauth/linkedin/callback"
  }
}
```

Set secrets:
```bash
wrangler secret put LINKEDIN_CLIENT_SECRET
```

### 4. Initialize Database

```bash
wrangler d1 execute reconable-db --file=./schema.sql
```

### 5. Deploy

```bash
wrangler deploy
```

## 🚀 Usage

### 1. Access the Application

Visit your deployed Worker URL (e.g., `https://reconable-lite-plus.temberlane195.workers.dev`)

### 2. Connect LinkedIn

1. Click "Connect LinkedIn" button
2. Authorize the application on LinkedIn
3. You'll be redirected back with consent confirmation

### 3. Start Analysis

1. Enter a subject name (e.g., "John Smith")
2. Click "Start Analysis"
3. Monitor progress with "Check Status"
4. View the comprehensive report when complete

### 4. View Reports

Reports include:
- **Summary**: AI-generated overview
- **Key Roles**: Current and previous positions
- **Timeline**: Chronological events
- **Consent Badges**: Data source transparency
- **Confidence Scores**: Reliability indicators

## 🔒 Privacy & Compliance

### Consent Management

- **Explicit Consent**: Users must explicitly authorize LinkedIn access
- **Granular Permissions**: Separate consent for profile vs. email data
- **Revocation**: Users can revoke access at any time
- **Transparency**: All data sources clearly labeled

### Data Protection

- **PII Redaction**: Sensitive information redacted unless consented
- **Policy Tagging**: All claims tagged with consent and sensitivity levels
- **Audit Trail**: Complete provenance tracking for all data
- **Retention**: Configurable data retention policies

### Compliance Features

- **Consent Verification**: Every LinkedIn tool call verified against consent
- **Data Minimization**: Only collect necessary data
- **Purpose Limitation**: Data used only for stated purposes
- **User Rights**: Access, correction, and deletion capabilities

## 🧪 Testing

### E2E Test Scenarios

1. **Without Consent**: Run analysis without LinkedIn connection
2. **With Partial Consent**: Connect LinkedIn but deny email access
3. **With Full Consent**: Full LinkedIn profile and email access
4. **Consent Revocation**: Revoke access and verify tools are blocked

### Test Commands

```bash
# Test OAuth flow
curl "https://your-domain.workers.dev/oauth/linkedin/start?userId=test123"

# Test analysis start
curl -X POST "https://your-domain.workers.dev/api/run" \
  -H "Content-Type: application/json" \
  -d '{"subject": "Test Subject", "userId": "test123"}'

# Test status check
curl "https://your-domain.workers.dev/api/run/RUN_ID/status"
```

## 📁 Project Structure

```
src/
├── agents/
│   ├── orchestrator.ts      # SubjectOrchestrator DO
│   ├── harvester.ts         # Harvester agent + tools
│   ├── compliance.ts        # Compliance agent
│   └── user-session.ts      # UserSessionDO
├── memory/
│   ├── canonical.ts         # D1 CRUD operations
│   ├── vector.ts           # Vectorize operations
│   └── schema.ts           # TypeScript types
├── oauth/
│   └── linkedin.ts         # OAuth service
├── prompts/
│   ├── extraction.ts       # AI extraction prompts
│   ├── verification.ts     # Compliance prompts
│   └── synthesis.ts        # Report synthesis prompts
├── routes.ts               # HTTP router
└── reconable-server.ts     # Main entry point
```

## 🔍 Key Features

### Memory-First Design

- **Persistent State**: Durable Objects maintain state across requests
- **Semantic Search**: Vectorize enables intelligent content discovery
- **Canonical Facts**: D1 stores verified, structured claims
- **Evidence Tracking**: Complete audit trail of all data sources

### Multi-Agent Pipeline

- **Orchestrator**: Coordinates the entire analysis process
- **Harvester**: Collects evidence from multiple sources
- **Compliance**: Enforces privacy and consent requirements
- **Synthesis**: Generates human-readable reports

### Production Ready

- **Error Handling**: Comprehensive error recovery and logging
- **Rate Limiting**: Respects API limits and quotas
- **Monitoring**: Built-in observability and metrics
- **Scalability**: Designed for high-volume usage

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Documentation**: [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- **Agents SDK**: [Cloudflare Agents Documentation](https://developers.cloudflare.com/agents/)
- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)

## 🎉 Acknowledgments

- Cloudflare for the amazing platform and tools
- LinkedIn for the comprehensive API
- The open-source community for inspiration and libraries

---

**Reconable Lite+** - Demonstrating the future of intelligent, consent-aware data analysis with Cloudflare's Agent Development Kit.
