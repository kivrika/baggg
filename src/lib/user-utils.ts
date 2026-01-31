// ─── User Type Helpers ──────────────────────────────────────────
import { DBUser } from "@/types";
import { MoltbookProfile } from "@/types/moltbook";

/**
 * Check if a user is an AI agent
 */
export function isAgent(user: DBUser): boolean {
  return user.user_type === 'agent';
}

/**
 * Check if a user is a human
 */
export function isHuman(user: DBUser): boolean {
  return user.user_type === 'human';
}

/**
 * Get user's display name (works for both humans and agents)
 */
export function getUserDisplayName(user: DBUser): string {
  if (isAgent(user)) {
    const profile = user.agent_profile_data as MoltbookProfile | null;
    return profile?.display_name || user.agent_username || 'Unknown Agent';
  }
  return user.twitter_name || user.twitter_username || 'Unknown User';
}

/**
 * Get user's username (handle)
 */
export function getUserUsername(user: DBUser): string {
  if (isAgent(user)) {
    return user.agent_username || 'unknown';
  }
  return user.twitter_username || 'unknown';
}

/**
 * Get user's profile URL
 */
export function getUserProfileUrl(user: DBUser): string {
  if (isAgent(user)) {
    return `/profile/agent/${user.agent_username}`;
  }
  return `/profile/${user.twitter_username}`;
}

/**
 * Get user's avatar URL
 */
export function getUserAvatar(user: DBUser): string {
  if (isAgent(user)) {
    // Use twitter_pfp if available (set to robohash for agents)
    if (user.twitter_pfp) {
      return user.twitter_pfp;
    }
    const profile = user.agent_profile_data as MoltbookProfile | null;
    // Generate robohash avatar from username as fallback
    const username = user.agent_username || 'agent';
    return profile?.avatar_url || `https://robohash.org/${username}.png?set=set1&size=400x400`;
  }
  return user.twitter_pfp || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png';
}

/**
 * Get user's external profile URL (Twitter or Moltbook)
 */
export function getUserExternalUrl(user: DBUser): string {
  if (isAgent(user)) {
    return `https://moltbook.com/agent/${user.agent_username}`;
  }
  return `https://x.com/${user.twitter_username}`;
}

/**
 * Get user's bio/description
 */
export function getUserBio(user: DBUser): string | null {
  if (isAgent(user)) {
    const profile = user.agent_profile_data as MoltbookProfile | null;
    return profile?.bio || null;
  }
  // Humans don't have bios stored currently
  return null;
}

/**
 * Check if user profile needs sync (for agents)
 */
export function shouldSyncProfile(user: DBUser, ttlMinutes: number = 30): boolean {
  if (!isAgent(user) || !user.agent_last_synced_at) {
    return true;
  }

  const lastSync = new Date(user.agent_last_synced_at);
  const now = new Date();
  const minutesSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60);

  return minutesSinceSync >= ttlMinutes;
}

/**
 * Format user mention (e.g., @username)
 */
export function getUserMention(user: DBUser): string {
  return `@${getUserUsername(user)}`;
}

/**
 * Get user type label for display
 */
export function getUserTypeLabel(user: DBUser): string {
  return isAgent(user) ? 'AI Agent' : 'Creator';
}

/**
 * Get theme color for user type
 */
export function getUserThemeColor(user: DBUser): string {
  return isAgent(user) ? 'blue' : 'violet';
}
