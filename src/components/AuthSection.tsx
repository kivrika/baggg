"use client";

import React, { useEffect, useState, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import LaunchCoinButton from "@/components/LaunchCoinButton";
import WalletInfo from "@/components/WalletInfo";
import FeeClaim from "@/components/FeeClaim";
import ChatSettingsPanel from "@/components/ChatSettingsPanel";
import MessageInbox from "@/components/MessageInbox";
import { DBUser } from "@/types";
import { getOrCreateWallet } from "@/lib/wallet";

interface AuthSectionProps {
  onUserSynced?: () => void;
}

function AuthSectionInner({ onUserSynced }: AuthSectionProps) {
  const { ready, authenticated, user } = usePrivy();
  const [currentUser, setCurrentUser] = useState<DBUser | null>(null);
  const [synced, setSynced] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Initialize wallet
  useEffect(() => {
    const wallet = getOrCreateWallet();
    setWalletAddress(wallet.publicKey);
  }, []);

  const syncUser = useCallback(async () => {
    if (!user?.twitter?.username) return;

    try {
      const res = await fetch("/api/auth/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privyId: user.id,
          twitterUsername: user.twitter.username,
          twitterName: user.twitter.name,
          twitterPfp: user.twitter.profilePictureUrl,
          walletAddress: walletAddress,
        }),
      });
      const data = await res.json();
      setCurrentUser(data.user);
      setSynced(true);
      onUserSynced?.();
    } catch (error) {
      console.error("Failed to sync user:", error);
    }
  }, [user?.id, user?.twitter?.username, user?.twitter?.name, user?.twitter?.profilePictureUrl, walletAddress, onUserSynced]);

  useEffect(() => {
    if (ready && authenticated && user?.twitter && !synced) {
      syncUser();
    }
  }, [ready, authenticated, user?.twitter, synced, syncUser]);

  if (!ready || !authenticated) return null;

  if (currentUser && !currentUser.token_mint) {
    return (
      <>
        <WalletInfo />
        <div className="max-w-md mx-auto mb-12 p-6 rounded-xl border border-violet-500/30 bg-violet-500/5">
          <h2 className="text-lg font-semibold text-center mb-3">Launch your coin</h2>
          <p className="text-sm text-gray-400 text-center mb-4">
            Create your personal token on Solana. Others can buy and sell it.
          </p>
          <LaunchCoinButton onLaunched={() => setSynced(false)} />
        </div>
      </>
    );
  }

  if (currentUser?.token_mint) {
    // Use the wallet_address from DB (fee claimer) for fetching fees
    // But also pass current wallet for signing
    const feeClaimerWallet = currentUser.wallet_address || walletAddress;

    return (
      <>
        <WalletInfo />
        <div className="max-w-md mx-auto mb-12 p-4 rounded-xl border border-green-500/30 bg-green-500/5">
          <div className="text-center">
            <p className="text-green-400 font-medium">Your coin is live: {currentUser.token_symbol}</p>
            <p className="text-xs text-gray-500 font-mono mt-1">{currentUser.token_mint}</p>
          </div>
          {feeClaimerWallet && (
            <FeeClaim
              tokenMint={currentUser.token_mint}
              walletAddress={feeClaimerWallet}
              signerWallet={walletAddress || undefined}
            />
          )}

          {/* Chat Settings */}
          {user?.id && currentUser.token_symbol && (
            <ChatSettingsPanel
              privyId={user.id}
              tokenSymbol={currentUser.token_symbol}
            />
          )}

          {/* Message Inbox */}
          {user?.id && (
            <MessageInbox privyId={user.id} />
          )}
        </div>
      </>
    );
  }

  return null;
}

// Error boundary: silently handles missing Privy provider
class PrivyGuard extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default function AuthSection(props: AuthSectionProps) {
  return (
    <PrivyGuard>
      <AuthSectionInner {...props} />
    </PrivyGuard>
  );
}
