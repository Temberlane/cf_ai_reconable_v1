/**
 * Reconable Lite+ Server
 * Main entry point for the web scraping multi-agent pipeline
 */

import { Routes } from './routes';
import { SubjectOrchestrator } from './agents/orchestrator';

interface Env {
  AI: Fetcher;
  BROWSER_RENDERING: Fetcher;
  DB: D1Database;
  VECTORIZE_INDEX: VectorizeIndex;
  SUBJECT_ORCHESTRATOR: DurableObjectNamespace;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const routes = new Routes(env);
    return await routes.handle(request);
  }
};

// Export Durable Object classes
export { SubjectOrchestrator };