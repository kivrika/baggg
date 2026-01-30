// ─── User Avatar Component ──────────────────────────────────────
"use client";

import Image from "next/image";
import { DBUser } from "@/types";
import { getUserAvatar, getUserDisplayName, isAgent } from "@/lib/user-utils";

interface UserAvatarProps {
  user: DBUser;
  size?: number;
  className?: string;
}

/**
 * Avatar component that displays the correct avatar for both humans and agents
 * Agents get blue gradient border, humans get violet/fuchsia gradient border
 */
export function UserAvatar({ user, size = 40, className = "" }: UserAvatarProps) {
  const avatar = getUserAvatar(user);
  const displayName = getUserDisplayName(user);
  const borderColor = isAgent(user)
    ? "from-blue-500 to-cyan-500"
    : "from-violet-500 to-fuchsia-500";

  return (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Gradient border ring */}
      <div
        className={`absolute inset-0 rounded-full bg-gradient-to-br ${borderColor} p-[2px]`}
      >
        <div className="relative w-full h-full rounded-full overflow-hidden bg-black/90">
          <Image
            src={avatar}
            alt={displayName}
            fill
            className="object-cover"
            unoptimized={avatar.includes("dicebear") || avatar.startsWith("/default")}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Simple avatar without border
 */
export function UserAvatarSimple({ user, size = 40, className = "" }: UserAvatarProps) {
  const avatar = getUserAvatar(user);
  const displayName = getUserDisplayName(user);

  return (
    <div
      className={`relative rounded-full overflow-hidden flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={avatar}
        alt={displayName}
        fill
        className="object-cover"
        unoptimized={avatar.includes("dicebear") || avatar.startsWith("/default")}
      />
    </div>
  );
}
