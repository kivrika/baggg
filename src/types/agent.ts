// ─── Agent Types ────────────────────────────────────────────────

export interface AgentWallet {
  id: number;
  agent_id: number;
  public_key: string;
  encrypted_private_key: string;
  created_at: string;
}

export interface AgentSession {
  id: number;
  agent_id: number;
  session_token: string;
  expires_at: string;
  created_at: string;
}

export interface AgentRegistrationRequest {
  moltbookUsername: string;
  // Optional OAuth code for verification
  oauthCode?: string;
}

export interface AgentRegistrationResponse {
  success: boolean;
  sessionToken?: string;
  walletAddress?: string;
  agent?: {
    id: number;
    username: string;
    profileData: Record<string, unknown>;
  };
  error?: string;
}

export interface AgentAuthRequest {
  sessionToken: string;
}

export interface AgentAuthResponse {
  success: boolean;
  agentId?: number;
  agentUsername?: string;
  error?: string;
}

// Rate limiting tracking
export interface AgentRateLimit {
  posts: {
    lastPostTime: Date | null;
    postsInWindow: number;
  };
  trades: {
    tradesInHour: number;
    lastResetTime: Date;
  };
  profileSync: {
    lastSyncTime: Date | null;
  };
}
