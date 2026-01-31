"use client";

import { useState } from "react";

export interface FeeClaimer {
  username: string;
  provider: "moltbook" | "twitter" | "github";
  wallet?: string;
  percentage: number;
}

interface FeeShareConfigProps {
  onClaimersChange: (claimers: FeeClaimer[]) => void;
  disabled?: boolean;
}

export default function FeeShareConfig({ onClaimersChange, disabled }: FeeShareConfigProps) {
  const [claimers, setClaimers] = useState<FeeClaimer[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newProvider, setNewProvider] = useState<"moltbook" | "twitter" | "github">("moltbook");
  const [newPercentage, setNewPercentage] = useState(50);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPercentage = claimers.reduce((sum, c) => sum + c.percentage, 0);
  const remainingPercentage = 100 - totalPercentage;

  const addClaimer = async () => {
    if (!newUsername.trim()) {
      setError("Enter a username");
      return;
    }

    if (newPercentage <= 0 || newPercentage > remainingPercentage) {
      setError(`Percentage must be 1-${remainingPercentage}%`);
      return;
    }

    setResolving(true);
    setError(null);

    try {
      // Resolve username to wallet address
      const res = await fetch(
        `/api/identity/resolve-wallet?provider=${newProvider}&username=${encodeURIComponent(newUsername.trim())}`
      );

      const data = await res.json();

      if (!data.success || !data.wallet) {
        throw new Error(data.error || "Failed to resolve wallet");
      }

      const newClaimer: FeeClaimer = {
        username: newUsername.trim(),
        provider: newProvider,
        wallet: data.wallet,
        percentage: newPercentage,
      };

      const updatedClaimers = [...claimers, newClaimer];
      setClaimers(updatedClaimers);
      onClaimersChange(updatedClaimers);

      // Reset form
      setNewUsername("");
      setNewPercentage(Math.min(50, remainingPercentage - newPercentage));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add claimer");
    } finally {
      setResolving(false);
    }
  };

  const removeClaimer = (index: number) => {
    const updatedClaimers = claimers.filter((_, i) => i !== index);
    setClaimers(updatedClaimers);
    onClaimersChange(updatedClaimers);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-white">Fee Sharing (Optional)</h3>
          <p className="text-xs text-gray-400 mt-1">
            Share trading fees with AI agents or other creators
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">Your share</div>
          <div className="text-lg font-bold text-violet-400">{remainingPercentage}%</div>
        </div>
      </div>

      {/* Existing claimers */}
      {claimers.length > 0 && (
        <div className="space-y-2">
          {claimers.map((claimer, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-lg bg-white/[0.05] border border-white/[0.1]"
            >
              <div className="flex-1">
                <div className="text-sm text-white font-medium">
                  @{claimer.username}
                </div>
                <div className="text-xs text-gray-400">
                  {claimer.provider} · {claimer.wallet?.slice(0, 8)}...
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm font-bold text-violet-400">
                  {claimer.percentage}%
                </div>
                <button
                  onClick={() => removeClaimer(index)}
                  disabled={disabled}
                  className="text-gray-400 hover:text-red-400 transition disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add new claimer form */}
      {remainingPercentage > 0 && (
        <div className="space-y-3 p-4 rounded-lg bg-white/[0.03] border border-white/[0.08]">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Platform</label>
              <select
                value={newProvider}
                onChange={(e) => setNewProvider(e.target.value as typeof newProvider)}
                disabled={disabled || resolving}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.1] text-white text-sm focus:outline-none focus:border-violet-500/50 disabled:opacity-50"
              >
                <option value="moltbook">Moltbook</option>
                <option value="twitter">Twitter</option>
                <option value="github">GitHub</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Share %</label>
              <input
                type="number"
                min="1"
                max={remainingPercentage}
                value={newPercentage}
                onChange={(e) => setNewPercentage(Number(e.target.value))}
                disabled={disabled || resolving}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.1] text-white text-sm focus:outline-none focus:border-violet-500/50 disabled:opacity-50"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Enter username"
              disabled={disabled || resolving}
              onKeyDown={(e) => e.key === "Enter" && addClaimer()}
              className="flex-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.1] text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500/50 disabled:opacity-50"
            />
            <button
              onClick={addClaimer}
              disabled={disabled || resolving || !newUsername.trim()}
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resolving ? "..." : "Add"}
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
        </div>
      )}

      {remainingPercentage === 0 && (
        <p className="text-xs text-amber-400">
          100% allocated. Remove a claimer to add more.
        </p>
      )}
    </div>
  );
}
