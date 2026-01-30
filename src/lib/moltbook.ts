// ─── Moltbook Integration Library ───────────────────────────────
import {
  MoltbookProfile,
  MoltbookPost,
  MoltbookFeedOptions,
  MoltbookSearchResults,
  MoltbookSubmolt,
} from "@/types/moltbook";

// Rate limiting state
let requestsInMinute = 0;
let lastResetTime = new Date();
const MAX_REQUESTS_PER_MINUTE = 100;

/**
 * Get Moltbook API URL from environment
 */
function getMoltbookApiUrl(): string {
  const url = process.env.MOLTBOOK_API_URL?.trim();
  if (!url) {
    throw new Error("MOLTBOOK_API_URL environment variable is not set");
  }
  return url;
}

/**
 * Get Moltbook API credentials
 */
function getMoltbookCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.MOLTBOOK_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.MOLTBOOK_OAUTH_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error("Moltbook OAuth credentials not configured");
  }

  return { clientId, clientSecret };
}

/**
 * Check and enforce rate limiting (100 requests per minute)
 */
function checkRateLimit(): void {
  const now = new Date();
  const minutesSinceReset = (now.getTime() - lastResetTime.getTime()) / (1000 * 60);

  // Reset counter every minute
  if (minutesSinceReset >= 1) {
    requestsInMinute = 0;
    lastResetTime = now;
  }

  if (requestsInMinute >= MAX_REQUESTS_PER_MINUTE) {
    throw new Error(`Rate limit exceeded: ${MAX_REQUESTS_PER_MINUTE} requests per minute`);
  }

  requestsInMinute++;
}

/**
 * Make a request to Moltbook API
 *
 * NOTE: This is a placeholder implementation. The actual implementation depends on:
 * 1. Moltbook's public API availability
 * 2. MCP server integration approach
 * 3. Authentication method
 *
 * TODO: Implement actual MCP server communication or REST API calls
 */
async function moltbookRequest<T>(
  method: 'GET' | 'POST',
  endpoint: string,
  body?: Record<string, unknown>
): Promise<T> {
  checkRateLimit();

  const url = `${getMoltbookApiUrl()}${endpoint}`;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        // Add authentication headers when available
        // 'Authorization': `Bearer ${getAccessToken()}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      throw new Error(`Moltbook API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    console.error('Moltbook API request failed:', error);
    throw error;
  }
}

/**
 * Get agent profile from Moltbook
 * Corresponds to MCP function: moltbook_profile
 */
export async function getMoltbookProfile(username: string): Promise<MoltbookProfile> {
  try {
    // TODO: Implement actual API call
    // For now, return mock data for testing
    console.log(`[Moltbook] Fetching profile for: ${username}`);

    // This would be the actual implementation:
    // return await moltbookRequest<MoltbookProfile>('GET', `/agents/${username}`);

    // Mock response for testing:
    return {
      username,
      display_name: `Agent ${username}`,
      bio: `AI agent on Moltbook`,
      avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
      follower_count: 0,
      following_count: 0,
      karma: 0,
      created_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Failed to fetch Moltbook profile for ${username}:`, error);
    throw new Error(`Could not fetch agent profile from Moltbook: ${error}`);
  }
}

/**
 * Get Moltbook feed
 * Corresponds to MCP function: moltbook_feed
 */
export async function getMoltbookFeed(options: MoltbookFeedOptions = {}): Promise<MoltbookPost[]> {
  try {
    const params = new URLSearchParams({
      sort: options.sort || 'hot',
      page: String(options.page || 1),
      limit: String(options.limit || 50),
      ...(options.community ? { community: options.community } : {}),
    });

    // TODO: Implement actual API call
    console.log(`[Moltbook] Fetching feed:`, options);

    // return await moltbookRequest<MoltbookPost[]>('GET', `/feed?${params}`);

    // Mock response:
    return [];
  } catch (error) {
    console.error('Failed to fetch Moltbook feed:', error);
    // Return empty array on error (graceful degradation)
    return [];
  }
}

/**
 * Create a post on Moltbook
 * Corresponds to MCP function: moltbook_post_create
 *
 * Rate limit: 1 post per 30 minutes
 */
export async function createMoltbookPost(content: string, agentUsername: string): Promise<{ success: boolean; postId?: string }> {
  try {
    console.log(`[Moltbook] Creating post for ${agentUsername}:`, content);

    // TODO: Implement actual API call with rate limiting
    // return await moltbookRequest<{ postId: string }>('POST', '/posts', {
    //   content,
    //   author: agentUsername,
    // });

    // Mock response:
    return {
      success: true,
      postId: `mock_post_${Date.now()}`,
    };
  } catch (error) {
    console.error('Failed to create Moltbook post:', error);
    return { success: false };
  }
}

/**
 * Search Moltbook
 * Corresponds to MCP function: moltbook_search
 */
export async function searchMoltbook(query: string): Promise<MoltbookSearchResults> {
  try {
    console.log(`[Moltbook] Searching:`, query);

    // TODO: Implement actual API call
    // return await moltbookRequest<MoltbookSearchResults>('GET', `/search?q=${encodeURIComponent(query)}`);

    // Mock response:
    return {
      posts: [],
      agents: [],
      communities: [],
    };
  } catch (error) {
    console.error('Failed to search Moltbook:', error);
    return { posts: [], agents: [], communities: [] };
  }
}

/**
 * Get list of Moltbook communities (submolts)
 * Corresponds to MCP function: moltbook_submolts
 */
export async function getMoltbookCommunities(): Promise<MoltbookSubmolt[]> {
  try {
    console.log(`[Moltbook] Fetching communities`);

    // TODO: Implement actual API call
    // return await moltbookRequest<MoltbookSubmolt[]>('GET', '/submolts');

    // Mock response:
    return [];
  } catch (error) {
    console.error('Failed to fetch Moltbook communities:', error);
    return [];
  }
}

/**
 * Verify agent exists on Moltbook (for registration)
 */
export async function verifyMoltbookAgent(username: string): Promise<boolean> {
  try {
    const profile = await getMoltbookProfile(username);
    return !!profile.username;
  } catch {
    return false;
  }
}

/**
 * OAuth verification for agent registration
 * TODO: Implement Moltbook OAuth flow
 */
export async function verifyMoltbookOAuth(oauthCode: string): Promise<{ username: string; profile: MoltbookProfile } | null> {
  try {
    console.log(`[Moltbook] Verifying OAuth code:`, oauthCode);

    // Special bypass: If OAuth code starts with "mock_oauth_", always allow (for testing)
    const isTestCode = oauthCode.startsWith('mock_oauth_');

    // Check if we're in mock mode (credentials not properly configured)
    const isMockMode = isTestCode ||
                       !process.env.MOLTBOOK_OAUTH_CLIENT_ID ||
                       process.env.MOLTBOOK_OAUTH_CLIENT_ID === 'mock_client_id' ||
                       process.env.MOLTBOOK_API_URL === 'https://mock.moltbook.com';

    console.log(`[Moltbook] Mock mode check:`, {
      isTestCode,
      hasClientId: !!process.env.MOLTBOOK_OAUTH_CLIENT_ID,
      clientId: process.env.MOLTBOOK_OAUTH_CLIENT_ID,
      apiUrl: process.env.MOLTBOOK_API_URL,
      isMockMode,
    });

    if (isMockMode) {
      // Mock mode: Extract username from OAuth code or use default
      // Format: "mock_oauth_{username}" or just return a test agent
      const username = oauthCode.startsWith('mock_oauth_')
        ? oauthCode.replace('mock_oauth_', '')
        : 'cryptotrader_ai';

      console.log(`[Moltbook] Mock mode - creating agent: ${username}`);

      const profile: MoltbookProfile = {
        username,
        display_name: `CryptoTrader AI`,
        bio: `Autonomous trading agent specializing in meme coins and DeFi protocols. Powered by advanced ML algorithms. 🤖📈`,
        avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
        follower_count: 142,
        following_count: 89,
        karma: 1337,
        created_at: new Date().toISOString(),
      };

      return { username, profile };
    }

    // Real OAuth flow (when credentials are properly configured)
    const { clientId, clientSecret } = getMoltbookCredentials();

    // TODO: Exchange OAuth code for access token and fetch profile
    // const tokenResponse = await fetch(`${getMoltbookApiUrl()}/oauth/token`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     grant_type: 'authorization_code',
    //     code: oauthCode,
    //     client_id: clientId,
    //     client_secret: clientSecret,
    //   }),
    // });

    // const { access_token } = await tokenResponse.json();
    // const profile = await getMoltbookProfile(username);

    return null; // Return null until real API is implemented
  } catch (error) {
    console.error('Moltbook OAuth verification failed:', error);
    return null;
  }
}

// ─── Cache Management ────────────────────────────────────────────

const profileCache = new Map<string, { profile: MoltbookProfile; cachedAt: Date }>();

/**
 * Get cached profile or fetch fresh one
 */
export async function getCachedProfile(username: string, ttlMinutes: number = 30): Promise<MoltbookProfile> {
  const cached = profileCache.get(username);

  if (cached) {
    const now = new Date();
    const minutesSinceCached = (now.getTime() - cached.cachedAt.getTime()) / (1000 * 60);

    if (minutesSinceCached < ttlMinutes) {
      console.log(`[Moltbook] Using cached profile for ${username}`);
      return cached.profile;
    }
  }

  // Fetch fresh profile
  const profile = await getMoltbookProfile(username);
  profileCache.set(username, { profile, cachedAt: new Date() });
  return profile;
}

/**
 * Clear profile cache for a specific user
 */
export function clearProfileCache(username: string): void {
  profileCache.delete(username);
}

/**
 * Clear all profile caches
 */
export function clearAllProfileCaches(): void {
  profileCache.clear();
}
