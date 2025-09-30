import { routeAgentRequest, type Schedule } from "agents";

import { getSchedulePrompt } from "agents/schedule";

import { AIChatAgent } from "agents/ai-chat-agent";
import {
  generateId,
  streamText,
  type StreamTextOnFinishCallback,
  stepCountIs,
  createUIMessageStream,
  convertToModelMessages,
  createUIMessageStreamResponse,
  type ToolSet
} from "ai";
import { openai } from "@ai-sdk/openai";
import { processToolCalls, cleanupMessages } from "./utils";
import { tools, executions } from "./tools";
import { LinkedInOAuthService } from "./linkedin-oauth";
// import { env } from "cloudflare:workers";

interface Env {
  Chat: DurableObjectNamespace;
  AI: Fetcher;
  BROWSER_RENDERING: Fetcher;
  LINKEDIN_TOKENS: KVNamespace;
  LINKEDIN_CLIENT_ID: string;
  LINKEDIN_CLIENT_SECRET: string;
  REQUEST_URL?: string;
  ASSETS: Fetcher;
}

const model = openai("gpt-4o-2024-11-20");
// Cloudflare AI Gateway
// const openai = createOpenAI({
//   apiKey: env.OPENAI_API_KEY,
//   baseURL: env.GATEWAY_BASE_URL,
// });

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env> {
  /**
   * Handles incoming chat messages and manages the response stream
   */
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ) {
    // const mcpConnection = await this.mcp.connect(
    //   "https://path-to-mcp-server/sse"
    // );

    // Collect all tools, including MCP tools
    const allTools = {
      ...tools,
      ...this.mcp.getAITools()
    };
    
    console.log('[SERVER] Available tools:', Object.keys(allTools));
    console.log('[SERVER] LinkedIn tools available:', {
      searchLinkedInProfile: 'searchLinkedInProfile' in allTools,
      analyzeLinkedInProfile: 'analyzeLinkedInProfile' in allTools,
      researchLinkedInCompany: 'researchLinkedInCompany' in allTools,
      analyzeLinkedInNetwork: 'analyzeLinkedInNetwork' in allTools
    });

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Clean up incomplete tool calls to prevent API errors
        const cleanedMessages = cleanupMessages(this.messages);

        // Process any pending tool calls from previous messages
        // This handles human-in-the-loop confirmations for tools
        console.log('[SERVER] Processing messages:', cleanedMessages.length);
        console.log('[SERVER] Last message content:', cleanedMessages[cleanedMessages.length - 1]?.content);
        
        const processedMessages = await processToolCalls({
          messages: cleanedMessages,
          dataStream: writer,
          tools: allTools,
          executions
        });
        
        console.log('[SERVER] Processed messages:', processedMessages.length);

        const result = streamText({
          system: `You are a helpful assistant that can do various tasks including LinkedIn OSINT (Open Source Intelligence) research with proper OAuth authentication.

Available LinkedIn tools:
- checkLinkedInAuth: Check if user is authenticated with LinkedIn and get auth URL if needed
- searchLinkedInProfile: Search for LinkedIn profiles using authenticated API (requires authentication)
- analyzeLinkedInProfile: Perform detailed analysis of a specific LinkedIn profile
- researchLinkedInCompany: Research company LinkedIn pages for intelligence gathering
- analyzeLinkedInNetwork: Analyze professional networks and connections

${getSchedulePrompt({ date: new Date() })}

If the user asks to schedule a task, use the schedule tool to schedule the task.

For LinkedIn operations:
1. ALWAYS check authentication first using checkLinkedInAuth with a userId
2. If not authenticated, provide the authUrl to the user for authentication
3. Once authenticated, use the appropriate LinkedIn tools for research

IMPORTANT: When a user mentions LinkedIn, searching for someone, OSINT, or intelligence gathering, you MUST:
1. First call checkLinkedInAuth to verify authentication
2. If authenticated, use the appropriate LinkedIn tools
3. If not authenticated, guide them through the OAuth process

CRITICAL: You have access to LinkedIn OSINT tools with OAuth authentication. When a user asks to search for someone, find LinkedIn profiles, or do OSINT research, you MUST:
1. Check their authentication status first
2. If authenticated, call searchLinkedInProfile with the appropriate parameters
3. If not authenticated, provide them with the authentication URL

EXAMPLE: If a user says "Search for John Smith on LinkedIn", you should:
1. Call checkLinkedInAuth with userId="user123"
2. If authenticated, call searchLinkedInProfile with userId="user123", name="John Smith"
3. If not authenticated, provide the authUrl for them to authenticate first
`,

          messages: convertToModelMessages(processedMessages),
          model,
          tools: allTools,
          // Type boundary: streamText expects specific tool types, but base class uses ToolSet
          // This is safe because our tools satisfy ToolSet interface (verified by 'satisfies' in tools.ts)
          onFinish: onFinish as unknown as StreamTextOnFinishCallback<
            typeof allTools
          >,
          stopWhen: stepCountIs(10),
          onToolCall: ({ toolCallId, toolName, args }) => {
            console.log('[SERVER] Tool called:', { toolCallId, toolName, args });
          }
        });

        writer.merge(result.toUIMessageStream());
      }
    });

    return createUIMessageStreamResponse({ stream });
  }
  async executeTask(description: string, _task: Schedule<string>) {
    await this.saveMessages([
      ...this.messages,
      {
        id: generateId(),
        role: "user",
        parts: [
          {
            type: "text",
            text: `Running scheduled task: ${description}`
          }
        ],
        metadata: {
          createdAt: new Date()
        }
      }
    ]);
  }
}

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);

    // LinkedIn OAuth routes
    if (url.pathname === "/auth/linkedin") {
      return handleLinkedInAuth(request, env);
    }
    
    if (url.pathname === "/auth/linkedin/callback") {
      return handleLinkedInCallback(request, env);
    }
    
    if (url.pathname === "/auth/linkedin/status") {
      return handleLinkedInStatus(request, env);
    }
    
    if (url.pathname === "/auth/linkedin/revoke") {
      return handleLinkedInRevoke(request, env);
    }

    if (url.pathname === "/check-open-ai-key") {
      const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
      return Response.json({
        success: hasOpenAIKey
      });
    }

    // Handle static assets and root path
    if (url.pathname === "/" || url.pathname.startsWith("/static/") || url.pathname.endsWith(".html") || url.pathname.endsWith(".js") || url.pathname.endsWith(".css") || url.pathname.endsWith(".ico")) {
      // Try to serve static assets first
      try {
        const assetResponse = await env.ASSETS.fetch(request);
        if (assetResponse.status !== 404) {
          return assetResponse;
        }
      } catch (error) {
        console.log('Asset not found, falling back to agent routing');
      }
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error(
        "OPENAI_API_KEY is not set, don't forget to set it locally in .dev.vars, and use `wrangler secret bulk .dev.vars` to upload it to production"
      );
    }
    
    return (
      // Route the request to our agent or return 404 if not found
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;

/**
 * Handle LinkedIn OAuth authorization initiation
 */
async function handleLinkedInAuth(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') || crypto.randomUUID();
    
    // Debug: Log what's available in the environment
    console.log('Environment variables available:', {
      LINKEDIN_CLIENT_ID: env.LINKEDIN_CLIENT_ID,
      LINKEDIN_CLIENT_SECRET: env.LINKEDIN_CLIENT_SECRET,
      LINKEDIN_TOKENS: !!env.LINKEDIN_TOKENS,
      allEnvKeys: Object.keys(env)
    });
    
    if (!env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_CLIENT_SECRET) {
      return Response.json({
        error: 'LinkedIn OAuth not configured. Missing client ID or secret.',
        debug: {
          hasClientId: !!env.LINKEDIN_CLIENT_ID,
          hasClientSecret: !!env.LINKEDIN_CLIENT_SECRET,
          availableKeys: Object.keys(env)
        }
      }, { status: 500 });
    }

    const oauthService = new LinkedInOAuthService({
      clientId: env.LINKEDIN_CLIENT_ID,
      clientSecret: env.LINKEDIN_CLIENT_SECRET,
      redirectUri: `${url.origin}/auth/linkedin/callback`,
      scopes: ['r_liteprofile', 'r_emailaddress', 'w_member_social']
    }, env.LINKEDIN_TOKENS);

    const state = crypto.randomUUID();
    const authUrl = oauthService.generateAuthUrl(state);
    
    // Store state for verification
    await env.LINKEDIN_TOKENS.put(`oauth_state_${state}`, userId, { expirationTtl: 600 });

    return Response.redirect(authUrl);
  } catch (error) {
    console.error('LinkedIn auth error:', error);
    return Response.json({
      error: 'Failed to initiate LinkedIn authentication'
    }, { status: 500 });
  }
}

/**
 * Handle LinkedIn OAuth callback
 */
async function handleLinkedInCallback(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      return Response.json({
        error: `LinkedIn OAuth error: ${error}`,
        description: url.searchParams.get('error_description')
      }, { status: 400 });
    }

    if (!code || !state) {
      return Response.json({
        error: 'Missing authorization code or state parameter'
      }, { status: 400 });
    }

    // Verify state
    const userId = await env.LINKEDIN_TOKENS.get(`oauth_state_${state}`);
    if (!userId) {
      return Response.json({
        error: 'Invalid or expired state parameter'
      }, { status: 400 });
    }

    // Clean up state
    await env.LINKEDIN_TOKENS.delete(`oauth_state_${state}`);

    const oauthService = new LinkedInOAuthService({
      clientId: env.LINKEDIN_CLIENT_ID,
      clientSecret: env.LINKEDIN_CLIENT_SECRET,
      redirectUri: `${url.origin}/auth/linkedin/callback`,
      scopes: ['r_liteprofile', 'r_emailaddress', 'w_member_social']
    }, env.LINKEDIN_TOKENS);

    const tokenData = await oauthService.exchangeCodeForToken(code, state);
    const userProfile = await oauthService.getUserProfile(userId);

    return Response.json({
      success: true,
      message: 'LinkedIn authentication successful',
      user: userProfile,
      expiresIn: tokenData.expires_in
    });
  } catch (error) {
    console.error('LinkedIn callback error:', error);
    return Response.json({
      error: 'Failed to complete LinkedIn authentication',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Check LinkedIn authentication status
 */
async function handleLinkedInStatus(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
      return Response.json({
        error: 'Missing userId parameter'
      }, { status: 400 });
    }

    const oauthService = new LinkedInOAuthService({
      clientId: env.LINKEDIN_CLIENT_ID,
      clientSecret: env.LINKEDIN_CLIENT_SECRET,
      redirectUri: `${url.origin}/auth/linkedin/callback`,
      scopes: ['r_liteprofile', 'r_emailaddress', 'w_member_social']
    }, env.LINKEDIN_TOKENS);

    const isAuthenticated = await oauthService.isAuthenticated(userId);
    
    if (isAuthenticated) {
      const userProfile = await oauthService.getUserProfile(userId);
      return Response.json({
        authenticated: true,
        user: userProfile
      });
    }

    return Response.json({
      authenticated: false,
      authUrl: oauthService.generateAuthUrl(crypto.randomUUID())
    });
  } catch (error) {
    console.error('LinkedIn status error:', error);
    return Response.json({
      error: 'Failed to check LinkedIn authentication status'
    }, { status: 500 });
  }
}

/**
 * Revoke LinkedIn access
 */
async function handleLinkedInRevoke(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
      return Response.json({
        error: 'Missing userId parameter'
      }, { status: 400 });
    }

    const oauthService = new LinkedInOAuthService({
      clientId: env.LINKEDIN_CLIENT_ID,
      clientSecret: env.LINKEDIN_CLIENT_SECRET,
      redirectUri: `${url.origin}/auth/linkedin/callback`,
      scopes: ['r_liteprofile', 'r_emailaddress', 'w_member_social']
    }, env.LINKEDIN_TOKENS);

    await oauthService.revokeToken(userId);

    return Response.json({
      success: true,
      message: 'LinkedIn access revoked successfully'
    });
  } catch (error) {
    console.error('LinkedIn revoke error:', error);
    return Response.json({
      error: 'Failed to revoke LinkedIn access'
    }, { status: 500 });
  }
}
