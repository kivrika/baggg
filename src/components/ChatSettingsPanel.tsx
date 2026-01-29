"use client";

import { useState, useEffect, useCallback } from "react";
import { ChatSettings } from "@/types";

interface ChatSettingsPanelProps {
  privyId: string;
  tokenSymbol: string;
}

export default function ChatSettingsPanel({ privyId, tokenSymbol }: ChatSettingsPanelProps) {
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [minAmount, setMinAmount] = useState("0");
  const [isEnabled, setIsEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/settings?privyId=${privyId}`);
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
        setMinAmount(data.settings.min_token_amount);
        setIsEnabled(data.settings.is_enabled);
      }
    } catch (e) {
      console.error("Failed to fetch chat settings:", e);
    }
  }, [privyId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch("/api/chat/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privyId,
          minTokenAmount: parseFloat(minAmount) || 0,
          isEnabled,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setStatus("Settings saved!");
      fetchSettings();
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : "Failed to save"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <h3 className="text-sm font-medium text-gray-300 mb-3">Chat Settings</h3>

      <div className="space-y-4">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Enable Chat</span>
          <button
            onClick={() => setIsEnabled(!isEnabled)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              isEnabled ? "bg-violet-600" : "bg-gray-700"
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                isEnabled ? "left-7" : "left-1"
              }`}
            />
          </button>
        </div>

        {/* Minimum Token Amount */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">
            Minimum {tokenSymbol} to Chat
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="1"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              disabled={!isEnabled}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/40 disabled:opacity-50"
              placeholder="0"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
              {tokenSymbol}
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Users must hold this amount to message you
          </p>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium text-sm transition disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save Settings"}
        </button>

        {/* Status Message */}
        {status && (
          <p className={`text-xs text-center ${status.includes("Error") ? "text-red-400" : "text-green-400"}`}>
            {status}
          </p>
        )}
      </div>
    </div>
  );
}
