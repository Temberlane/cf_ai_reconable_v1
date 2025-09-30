/**
 * HTTP routes for Reconable Lite+
 * Handles API endpoints for web scraping analysis
 */

import type { SubjectRun } from './memory/schema';
import { SubjectOrchestrator } from './agents/orchestrator';

interface Env {
  AI: Fetcher;
  BROWSER_RENDERING: Fetcher;
  DB: D1Database;
  VECTORIZE_INDEX: VectorizeIndex;
  SUBJECT_ORCHESTRATOR: DurableObjectNamespace;
}

export class Routes {
  constructor(private env: Env) {}

  /**
   * Handle all requests
   */
  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      let response: Response;

      // API Routes
      if (path.startsWith('/api/')) {
        response = await this.handleApiRequest(request);
      }
      // Static file serving
      else if (path === '/' || path.startsWith('/public/')) {
        response = await this.handleStaticRequest(request);
      }
      // Health check
      else if (path === '/health') {
        response = new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      // 404
      else {
        response = new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Add CORS headers to all responses
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;

    } catch (error) {
      console.error('Request handling error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  /**
   * Handle API requests
   */
  private async handleApiRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // GET /api/me - Get current user info (simplified for web scraping)
    if (path === '/api/me' && request.method === 'GET') {
      return new Response(JSON.stringify({
        user_id: 'web-scraping-user',
        data_sources: ['Web Scraping', 'LinkedIn Public Profiles', 'Search Engines'],
        privacy_level: 'public',
        consent_summary: {
          status: 'granted',
          granted: ['Web Scraping', 'Public Data'],
          required: []
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // POST /api/run - Start new analysis run
    if (path === '/api/run' && request.method === 'POST') {
      const body = await request.json() as { 
        subject: string; 
        inputType?: string; 
        maxApiCalls?: number; 
      };
      
      if (!body.subject) {
        return new Response(JSON.stringify({ error: 'Subject is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      try {
        // Determine if input is a LinkedIn profile URL
        const isLinkedInProfile = body.subject.includes('linkedin.com/in/') || body.subject.includes('linkedin.com/company/');
        const actualInputType = isLinkedInProfile ? 'linkedin' : (body.inputType || 'search');

        // Calculate estimated API calls
        let estimatedCalls = 1; // Base call
        if (actualInputType === 'linkedin') {
          estimatedCalls = 1; // Direct profile scraping
        } else {
          estimatedCalls = Math.min(5, body.maxApiCalls || 5); // Search + up to 5 profiles
        }

        const orchestratorId = this.env.SUBJECT_ORCHESTRATOR.idFromName('main');
        const orchestrator = this.env.SUBJECT_ORCHESTRATOR.get(orchestratorId) as SubjectOrchestrator;
        
        const run = await orchestrator.startRun(body.subject, actualInputType, estimatedCalls);
        
        return new Response(JSON.stringify({
          runId: run.id,
          subject: run.subject_name,
          status: run.status,
          inputType: actualInputType,
          estimatedCalls: estimatedCalls,
          message: `Analysis started successfully (${actualInputType === 'linkedin' ? 'LinkedIn Profile' : 'Search Query'})`
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Failed to start run:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to start analysis',
          message: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // GET /api/run/:id/status - Get run status
    if (path.match(/^\/api\/run\/[^\/]+\/status$/) && request.method === 'GET') {
      const runId = path.split('/')[3];
      
      try {
        const orchestratorId = this.env.SUBJECT_ORCHESTRATOR.idFromName('main');
        const orchestrator = this.env.SUBJECT_ORCHESTRATOR.get(orchestratorId) as SubjectOrchestrator;
        
        const run = await orchestrator.getRunStatus(runId);
        
        if (!run) {
          return new Response(JSON.stringify({ error: 'Run not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          runId: run.id,
          subject: run.subject_name,
          status: run.status,
          evidenceCount: run.evidence_count,
          claimsCount: run.claims_count,
          createdAt: run.created_at,
          updatedAt: run.updated_at,
          error: run.error
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Failed to get run status:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to get run status',
          message: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // GET /api/run/:id/report - Get run report
    if (path.match(/^\/api\/run\/[^\/]+\/report$/) && request.method === 'GET') {
      const runId = path.split('/')[3];
      
      try {
        const orchestratorId = this.env.SUBJECT_ORCHESTRATOR.idFromName('main');
        const orchestrator = this.env.SUBJECT_ORCHESTRATOR.get(orchestratorId) as SubjectOrchestrator;
        
        const report = await orchestrator.getRunReport(runId);
        
        if (!report) {
          return new Response(JSON.stringify({ error: 'Report not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          run: report.run,
          synthesis: report.synthesis,
          evidence: report.evidence,
          claims: report.claims,
          generatedAt: new Date().toISOString()
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Failed to get run report:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to get run report',
          message: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // GET /api/sources - Get available data sources
    if (path === '/api/sources' && request.method === 'GET') {
      return new Response(JSON.stringify({
        sources: [
          {
            id: 'web',
            name: 'Web Search',
            description: 'Search engines and public websites',
            privacyLevel: 'public',
            requiresConsent: false
          },
          {
            id: 'linkedin',
            name: 'LinkedIn Scraping',
            description: 'Public LinkedIn profiles and company pages',
            privacyLevel: 'public',
            requiresConsent: false
          }
        ]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 404 for unknown API endpoints
    return new Response(JSON.stringify({ error: 'API endpoint not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Handle static file requests
   */
  private async handleStaticRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    let path = url.pathname;

    // Serve index.html for root path
    if (path === '/') {
      path = '/index.html';
    }

    // Remove leading slash for asset path
    const assetPath = path.startsWith('/') ? path.slice(1) : path;

    try {
      // Try to get the asset from the public directory
      const asset = await this.env.ASSETS.fetch(new Request(`https://example.com/${assetPath}`));
      
      if (asset.status === 404) {
        return new Response(JSON.stringify({ error: 'File not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return asset;

    } catch (error) {
      console.error('Static file serving error:', error);
      return new Response(JSON.stringify({ error: 'Failed to serve file' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}