/**
 * Tool definitions for the AI chat agent
 * Tools can either require human confirmation or execute automatically
 */
import { tool, type ToolSet } from "ai";
import { z } from "zod/v3";

import type { Chat } from "./server";
import { getCurrentAgent } from "agents";
import { scheduleSchema } from "agents/schedule";
import { LinkedInOSINT } from "./linkedin-osint";
import { LinkedInOAuthService } from "./linkedin-oauth";

/**
 * Weather information tool that requires human confirmation
 * When invoked, this will present a confirmation dialog to the user
 */
const getWeatherInformation = tool({
  description: "show the weather in a given city to the user",
  inputSchema: z.object({ city: z.string() })
  // Omitting execute function makes this tool require human confirmation
});

/**
 * Local time tool that executes automatically
 * Since it includes an execute function, it will run without user confirmation
 * This is suitable for low-risk operations that don't need oversight
 */
const getLocalTime = tool({
  description: "get the local time for a specified location",
  inputSchema: z.object({ location: z.string() }),
  execute: async ({ location }) => {
    console.log(`Getting local time for ${location}`);
    return "10am";
  }
});

const scheduleTask = tool({
  description: "A tool to schedule a task to be executed at a later time",
  inputSchema: scheduleSchema,
  execute: async ({ when, description }) => {
    // we can now read the agent context from the ALS store
    const { agent } = getCurrentAgent<Chat>();

    function throwError(msg: string): string {
      throw new Error(msg);
    }
    if (when.type === "no-schedule") {
      return "Not a valid schedule input";
    }
    const input =
      when.type === "scheduled"
        ? when.date // scheduled
        : when.type === "delayed"
          ? when.delayInSeconds // delayed
          : when.type === "cron"
            ? when.cron // cron
            : throwError("not a valid schedule input");
    try {
      agent!.schedule(input!, "executeTask", description);
    } catch (error) {
      console.error("error scheduling task", error);
      return `Error scheduling task: ${error}`;
    }
    return `Task scheduled for type "${when.type}" : ${input}`;
  }
});

/**
 * Tool to list all scheduled tasks
 * This executes automatically without requiring human confirmation
 */
const getScheduledTasks = tool({
  description: "List all tasks that have been scheduled",
  inputSchema: z.object({}),
  execute: async () => {
    const { agent } = getCurrentAgent<Chat>();

    try {
      const tasks = agent!.getSchedules();
      if (!tasks || tasks.length === 0) {
        return "No scheduled tasks found.";
      }
      return tasks;
    } catch (error) {
      console.error("Error listing scheduled tasks", error);
      return `Error listing scheduled tasks: ${error}`;
    }
  }
});

/**
 * Tool to cancel a scheduled task by its ID
 * This executes automatically without requiring human confirmation
 */
const cancelScheduledTask = tool({
  description: "Cancel a scheduled task using its ID",
  inputSchema: z.object({
    taskId: z.string().describe("The ID of the task to cancel")
  }),
  execute: async ({ taskId }) => {
    const { agent } = getCurrentAgent<Chat>();
    try {
      await agent!.cancelSchedule(taskId);
      return `Task ${taskId} has been successfully canceled.`;
    } catch (error) {
      console.error("Error canceling scheduled task", error);
      return `Error canceling task ${taskId}: ${error}`;
    }
  }
});

/**
 * LinkedIn authentication tool
 * This tool checks if the user is authenticated with LinkedIn and provides auth URL if needed
 */
const checkLinkedInAuth = tool({
  description: "Check if the user is authenticated with LinkedIn and get authentication status. Use this before performing any LinkedIn operations to ensure proper authentication.",
  inputSchema: z.object({
    userId: z.string().describe("User ID to check authentication for")
  }),
  execute: async ({ userId }) => {
    console.log('[TOOLS] checkLinkedInAuth called with userId:', userId);
    
    const { agent } = getCurrentAgent<Chat>();
    if (!agent) {
      return {
        success: false,
        error: 'Agent not available'
      };
    }

    try {
      // Access environment through the agent's context
      const env = (agent as any).env;
      if (!env) {
        return {
          success: false,
          error: 'Agent environment not available'
        };
      }

      const oauthService = new LinkedInOAuthService({
        clientId: env.LINKEDIN_CLIENT_ID,
        clientSecret: env.LINKEDIN_CLIENT_SECRET,
        redirectUri: `${new URL(env.REQUEST_URL || 'https://your-domain.com').origin}/auth/linkedin/callback`,
        scopes: ['r_liteprofile', 'r_emailaddress', 'w_member_social']
      }, env.LINKEDIN_TOKENS);

      const isAuthenticated = await oauthService.isAuthenticated(userId);
      
      if (isAuthenticated) {
        const userProfile = await oauthService.getUserProfile(userId);
        return {
          success: true,
          authenticated: true,
          message: 'LinkedIn authentication active',
          user: userProfile
        };
      } else {
        const authUrl = oauthService.generateAuthUrl(crypto.randomUUID());
        return {
          success: true,
          authenticated: false,
          message: 'LinkedIn authentication required',
          authUrl: authUrl
        };
      }
    } catch (error) {
      console.error('[TOOLS] Error checking LinkedIn auth:', error);
      return {
        success: false,
        error: `Failed to check LinkedIn authentication: ${error}`
      };
    }
  }
});

/**
 * LinkedIn profile search tool that uses authenticated API
 * This tool searches for LinkedIn profiles using the LinkedIn API
 */
const searchLinkedInProfile = tool({
  description: "Search for LinkedIn profiles using authenticated LinkedIn API. Use this when the user wants to find someone on LinkedIn, search for a person, or do OSINT research on a specific individual. Requires LinkedIn authentication.",
  inputSchema: z.object({
    userId: z.string().describe("User ID for authentication"),
    name: z.string().describe("Full name of the person to search for"),
    location: z.string().optional().describe("Optional location to narrow down search results"),
    company: z.string().optional().describe("Optional company name to narrow down search results")
  }),
  execute: async ({ userId, name, location, company }) => {
    console.log('[TOOLS] searchLinkedInProfile called with:', { userId, name, location, company });
    
    const { agent } = getCurrentAgent<Chat>();
    if (!agent) {
      return {
        success: false,
        error: 'Agent not available'
      };
    }

    try {
      // Access environment through the agent's context
      const env = (agent as any).env;
      if (!env) {
        return {
          success: false,
          error: 'Agent environment not available'
        };
      }

      const oauthService = new LinkedInOAuthService({
        clientId: env.LINKEDIN_CLIENT_ID,
        clientSecret: env.LINKEDIN_CLIENT_SECRET,
        redirectUri: `${new URL(env.REQUEST_URL || 'https://your-domain.com').origin}/auth/linkedin/callback`,
        scopes: ['r_liteprofile', 'r_emailaddress', 'w_member_social']
      }, env.LINKEDIN_TOKENS);

      const isAuthenticated = await oauthService.isAuthenticated(userId);
      if (!isAuthenticated) {
        return {
          success: false,
          error: 'LinkedIn authentication required. Please authenticate first.',
          authUrl: oauthService.generateAuthUrl(crypto.randomUUID())
        };
      }

      // Use LinkedIn's people search API
      const searchResults = await oauthService.searchPeople(userId, name, {
        location,
        currentCompany: company
      });

      return {
        success: true,
        message: `Found ${searchResults.length} LinkedIn profiles for ${name}`,
        searchCriteria: {
          name,
          location: location || 'Not specified',
          company: company || 'Not specified'
        },
        results: searchResults.map((result: any) => ({
          name: result.firstName + ' ' + result.lastName,
          headline: result.headline || 'No headline available',
          location: result.locationName || 'Unknown',
          profileUrl: result.publicProfileUrl || `https://www.linkedin.com/in/${result.vanityName}`,
          profileImage: result.profilePicture?.displayImage
        }))
      };
    } catch (error) {
      console.error('[TOOLS] Error searching LinkedIn profiles:', error);
      return {
        success: false,
        error: `Failed to search LinkedIn profiles: ${error}`
      };
    }
  }
});

/**
 * LinkedIn profile analysis tool that requires human confirmation
 * This tool performs detailed OSINT analysis on a specific LinkedIn profile
 */
const analyzeLinkedInProfile = tool({
  description: "Perform detailed OSINT analysis on a specific LinkedIn profile URL. Use this when the user provides a LinkedIn profile URL and wants detailed information about that person's background, experience, education, skills, and professional network.",
  inputSchema: z.object({
    profileUrl: z.string().url().describe("The LinkedIn profile URL to analyze"),
    includeConnections: z.boolean().optional().default(false).describe("Whether to analyze mutual connections"),
    includePosts: z.boolean().optional().default(false).describe("Whether to analyze recent posts and activity")
  })
});

/**
 * LinkedIn company research tool that requires human confirmation
 * This tool researches a company's LinkedIn page for OSINT purposes
 */
const researchLinkedInCompany = tool({
  description: "Research a company's LinkedIn page for OSINT analysis. Use this when the user wants to investigate a company, learn about an organization, or gather intelligence about a business entity.",
  inputSchema: z.object({
    companyName: z.string().describe("Name of the company to research"),
    includeEmployees: z.boolean().optional().default(false).describe("Whether to analyze employee profiles"),
    includeRecentPosts: z.boolean().optional().default(false).describe("Whether to analyze recent company posts")
  })
});

/**
 * LinkedIn network analysis tool that requires human confirmation
 * This tool analyzes the network and connections of a LinkedIn profile
 */
const analyzeLinkedInNetwork = tool({
  description: "Analyze the LinkedIn network and connections of a specific profile. Use this when the user wants to understand someone's professional network, find mutual connections, or map relationships between professionals.",
  inputSchema: z.object({
    profileUrl: z.string().url().describe("The LinkedIn profile URL to analyze"),
    maxConnections: z.number().optional().default(50).describe("Maximum number of connections to analyze"),
    includeMutualConnections: z.boolean().optional().default(true).describe("Whether to find mutual connections")
  })
});

/**
 * Export all available tools
 * These will be provided to the AI model to describe available capabilities
 */
export const tools = {
  getWeatherInformation,
  getLocalTime,
  scheduleTask,
  getScheduledTasks,
  cancelScheduledTask,
  checkLinkedInAuth,
  searchLinkedInProfile,
  analyzeLinkedInProfile,
  researchLinkedInCompany,
  analyzeLinkedInNetwork
} satisfies ToolSet;

// Debug: Log tool registration
console.log('[TOOLS] Tools registered:', Object.keys(tools));
console.log('[TOOLS] LinkedIn tools in tools object:', {
  checkLinkedInAuth: 'checkLinkedInAuth' in tools,
  searchLinkedInProfile: 'searchLinkedInProfile' in tools,
  analyzeLinkedInProfile: 'analyzeLinkedInProfile' in tools,
  researchLinkedInCompany: 'researchLinkedInCompany' in tools,
  analyzeLinkedInNetwork: 'analyzeLinkedInNetwork' in tools
});

/**
 * Implementation of confirmation-required tools
 * This object contains the actual logic for tools that need human approval
 * Each function here corresponds to a tool above that doesn't have an execute function
 */
export const executions = {
  getWeatherInformation: async ({ city }: { city: string }) => {
    console.log(`Getting weather information for ${city}`);
    return `The weather in ${city} is sunny`;
  },


  analyzeLinkedInProfile: async ({ 
    profileUrl, 
    includeConnections, 
    includePosts 
  }: { 
    profileUrl: string; 
    includeConnections?: boolean; 
    includePosts?: boolean; 
  }) => {
    console.log('[TOOLS] analyzeLinkedInProfile called with:', { profileUrl, includeConnections, includePosts });
    console.log(`Analyzing LinkedIn profile: ${profileUrl}`);
    
    const { agent } = getCurrentAgent<Chat>();
    console.log('[TOOLS] Agent context retrieved for profile analysis:', !!agent);
    const linkedinOSINT = new LinkedInOSINT((agent as any)?.env);
    
    try {
      console.log('[TOOLS] Initializing LinkedInOSINT for profile analysis...');
      await linkedinOSINT.initialize();
      console.log('[TOOLS] Calling analyzeProfile...');
      const profile = await linkedinOSINT.analyzeProfile(profileUrl, includeConnections, includePosts);
      console.log('[TOOLS] Profile analysis completed, closing LinkedInOSINT...');
      await linkedinOSINT.close();
      
      console.log('[TOOLS] Returning profile analysis results:', { 
        name: profile.name, 
        experienceCount: profile.experience.length,
        skillsCount: profile.skills.length 
      });
      return {
        success: true,
        message: `Successfully analyzed LinkedIn profile for ${profile.name}`,
        profile: {
          name: profile.name,
          headline: profile.headline,
          location: profile.location,
          currentCompany: profile.currentCompany,
          about: profile.about,
          experience: profile.experience,
          education: profile.education,
          skills: profile.skills,
          connections: profile.connections,
          profileUrl: profile.profileUrl
        }
      };
    } catch (error) {
      console.error("[TOOLS] Error analyzing LinkedIn profile:", error);
      await linkedinOSINT.close();
      return {
        success: false,
        error: `Failed to analyze LinkedIn profile: ${error}`
      };
    }
  },

  researchLinkedInCompany: async ({ 
    companyName, 
    includeEmployees, 
    includeRecentPosts 
  }: { 
    companyName: string; 
    includeEmployees?: boolean; 
    includeRecentPosts?: boolean; 
  }) => {
    console.log('[TOOLS] researchLinkedInCompany called with:', { companyName, includeEmployees, includeRecentPosts });
    console.log(`Researching LinkedIn company: ${companyName}`);
    
    const { agent } = getCurrentAgent<Chat>();
    console.log('[TOOLS] Agent context retrieved for company research:', !!agent);
    const linkedinOSINT = new LinkedInOSINT((agent as any)?.env);
    
    try {
      console.log('[TOOLS] Initializing LinkedInOSINT for company research...');
      await linkedinOSINT.initialize();
      console.log('[TOOLS] Calling researchCompany...');
      const company = await linkedinOSINT.researchCompany(companyName, includeEmployees, includeRecentPosts);
      console.log('[TOOLS] Company research completed, closing LinkedInOSINT...');
      await linkedinOSINT.close();
      
      console.log('[TOOLS] Returning company research results:', { 
        name: company.name, 
        industry: company.industry,
        size: company.size 
      });
      return {
        success: true,
        message: `Successfully researched LinkedIn company: ${company.name}`,
        company: {
          name: company.name,
          industry: company.industry,
          size: company.size,
          location: company.location,
          website: company.website,
          description: company.description
        }
      };
    } catch (error) {
      console.error("[TOOLS] Error researching LinkedIn company:", error);
      await linkedinOSINT.close();
      return {
        success: false,
        error: `Failed to research LinkedIn company: ${error}`
      };
    }
  },

  analyzeLinkedInNetwork: async ({ 
    profileUrl, 
    maxConnections, 
    includeMutualConnections 
  }: { 
    profileUrl: string; 
    maxConnections?: number; 
    includeMutualConnections?: boolean; 
  }) => {
    console.log('[TOOLS] analyzeLinkedInNetwork called with:', { profileUrl, maxConnections, includeMutualConnections });
    console.log(`Analyzing LinkedIn network for: ${profileUrl}`);
    
    const { agent } = getCurrentAgent<Chat>();
    console.log('[TOOLS] Agent context retrieved for network analysis:', !!agent);
    const linkedinOSINT = new LinkedInOSINT((agent as any)?.env);
    
    try {
      console.log('[TOOLS] Initializing LinkedInOSINT for network analysis...');
      await linkedinOSINT.initialize();
      console.log('[TOOLS] Calling analyzeNetwork...');
      const network = await linkedinOSINT.analyzeNetwork(profileUrl, maxConnections, includeMutualConnections);
      console.log('[TOOLS] Network analysis completed, closing LinkedInOSINT...');
      await linkedinOSINT.close();
      
      console.log('[TOOLS] Returning network analysis results:', { 
        connectionsFound: network.connections.length,
        mutualConnections: network.mutualConnections.length 
      });
      return {
        success: true,
        message: `Successfully analyzed LinkedIn network with ${network.connections.length} connections`,
        network: {
          connections: network.connections.map(conn => ({
            name: conn.name,
            headline: conn.headline,
            location: conn.location,
            profileUrl: conn.profileUrl
          })),
          mutualConnections: network.mutualConnections
        }
      };
    } catch (error) {
      console.error("[TOOLS] Error analyzing LinkedIn network:", error);
      await linkedinOSINT.close();
      return {
        success: false,
        error: `Failed to analyze LinkedIn network: ${error}`
      };
    }
  }
};

// Debug: Log executions registration
console.log('[TOOLS] Executions registered:', Object.keys(executions));
console.log('[TOOLS] LinkedIn tools in executions object:', {
  checkLinkedInAuth: 'checkLinkedInAuth' in executions, // Now auto-execute
  searchLinkedInProfile: 'searchLinkedInProfile' in executions, // Now auto-execute
  analyzeLinkedInProfile: 'analyzeLinkedInProfile' in executions,
  researchLinkedInCompany: 'researchLinkedInCompany' in executions,
  analyzeLinkedInNetwork: 'analyzeLinkedInNetwork' in executions
});
