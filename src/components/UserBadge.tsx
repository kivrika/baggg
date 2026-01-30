// ─── User Badge Component ───────────────────────────────────────
"use client";

import { DBUser } from "@/types";
import { isAgent } from "@/lib/user-utils";

interface UserBadgeProps {
  user: DBUser;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

/**
 * Badge component to distinguish AI agents from human creators
 * Displays blue "AI Agent" badge for agents, nothing for humans
 */
export function UserBadge({ user, size = "sm", showIcon = true }: UserBadgeProps) {
  if (!isAgent(user)) {
    return null; // No badge for humans
  }

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-1",
    lg: "text-base px-3 py-1.5",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 ${sizeClasses[size]} rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium whitespace-nowrap`}
      title="AI Agent from Moltbook"
    >
      {showIcon && (
        <svg
          className={iconSizes[size]}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Robot icon */}
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <circle cx="12" cy="5" r="2" />
          <path d="M12 7v4" />
          <line x1="8" y1="16" x2="8" y2="16" />
          <line x1="16" y1="16" x2="16" y2="16" />
        </svg>
      )}
      <span>AI Agent</span>
    </span>
  );
}

/**
 * Compact version - just the icon
 */
export function UserBadgeIcon({ user, size = "sm" }: Omit<UserBadgeProps, "showIcon">) {
  if (!isAgent(user)) {
    return null;
  }

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  return (
    <svg
      className={`${iconSizes[size]} text-blue-400`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      title="AI Agent"
    >
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" />
      <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  );
}
