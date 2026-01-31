"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { getOrCreateWallet, getKeypair } from "@/lib/wallet";
import FeeShareConfig, { FeeClaimer } from "./FeeShareConfig";

// Solana RPC endpoint - can be configured via env or use fallback
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

interface LaunchCoinButtonProps {
  onLaunched?: (tokenMint: string) => void;
}

export default function LaunchCoinButton({ onLaunched }: LaunchCoinButtonProps) {
  const { user } = usePrivy();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [customTicker, setCustomTicker] = useState("");
  const [tickerError, setTickerError] = useState<string | null>(null);
  const [feeClaimers, setFeeClaimers] = useState<FeeClaimer[]>([]);

  useEffect(() => {
    const wallet = getOrCreateWallet();
    setWalletAddress(wallet.publicKey);
  }, []);

  // Validate ticker
  const validateTicker = (value: string) => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleaned.length > 10) return cleaned.slice(0, 10);
    return cleaned;
  };

  const handleTickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = validateTicker(e.target.value);
    setCustomTicker(value);

    if (value.length < 2) {
      setTickerError("Ticker must be at least 2 characters");
    } else if (value.length > 10) {
      setTickerError("Ticker cannot exceed 10 characters");
    } else {
      setTickerError(null);
    }
  };

  const signAndSendTransaction = async (txData: unknown, retries = 3): Promise<string> => {
    const keypair = getKeypair();
    if (!keypair) throw new Error("Wallet not found");

    const connection = new Connection(RPC_URL, {
      commitment: "confirmed",
      confirmTransactionInitialTimeout: 60000,
    });

    // Log the raw transaction data for debugging
    console.log("=== signAndSendTransaction called ===");
    console.log("Raw txData type:", typeof txData);
    console.log("Raw txData value:", txData);

    // Handle various input formats
    let txString: string;

    if (typeof txData === 'string') {
      txString = txData.trim();
      console.log("txData is string, length:", txString.length);
      console.log("txData first 100 chars:", txString.substring(0, 100));
      console.log("txData last 50 chars:", txString.substring(txString.length - 50));
    } else if (typeof txData === 'object' && txData !== null) {
      console.log("txData is object, keys:", Object.keys(txData));
      const txObj = txData as Record<string, unknown>;

      if ('transaction' in txObj && typeof txObj.transaction === 'string') {
        txString = (txObj.transaction as string).trim();
        console.log("Extracted transaction from object, length:", txString.length);
      } else if ('data' in txObj && typeof txObj.data === 'string') {
        txString = (txObj.data as string).trim();
        console.log("Extracted data from object, length:", txString.length);
      } else {
        console.error("Unknown object format:", JSON.stringify(txData));
        throw new Error(`Unknown transaction format: ${JSON.stringify(txData).substring(0, 200)}`);
      }
    } else {
      throw new Error(`Invalid transaction data type: ${typeof txData}`);
    }

    // Check if it's empty
    if (!txString || txString.length === 0) {
      throw new Error("Transaction string is empty");
    }

    // Try to decode - could be base64 or base58
    let txBytes: Uint8Array;
    try {
      // First try base58 (BagsAPI uses this)
      txBytes = bs58.decode(txString);
      console.log("Decoded as base58, length:", txBytes.length);
    } catch (e1) {
      console.log("base58 decode failed:", e1);
      // Fallback to base64
      try {
        txBytes = Uint8Array.from(atob(txString), (c) => c.charCodeAt(0));
        console.log("Decoded as base64, length:", txBytes.length);
      } catch (e2) {
        console.log("base64 decode failed:", e2);
        console.log("Full txString:", txString);
        console.log("First 10 char codes:", [...txString.substring(0, 10)].map(c => c.charCodeAt(0)));
        throw new Error(`Could not decode transaction (len=${txString.length}, start=${txString.substring(0, 20)}...)`);
      }
    }

    const transaction = VersionedTransaction.deserialize(txBytes);

    // Sign the transaction
    transaction.sign([keypair]);

    // Retry logic for rate-limited RPCs
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`Retry attempt ${attempt + 1}/${retries}...`);
          await new Promise(r => setTimeout(r, 2000 * attempt)); // Exponential backoff
        }

        // First simulate to catch errors before paying fees
        const simulation = await connection.simulateTransaction(transaction);
        if (simulation.value.err) {
          const simErr = JSON.stringify(simulation.value.err);
          console.error("Simulation failed:", simErr);
          console.error("Simulation logs:", simulation.value.logs);

          // Get error details from logs
          let friendlyError = simErr;
          const logs = simulation.value.logs || [];

          // Find the actual error in logs
          const errorLog = logs.find(l =>
            l.includes("Error") ||
            l.includes("failed") ||
            l.includes("insufficient") ||
            l.includes("already")
          );

          if (errorLog) {
            friendlyError = errorLog;
          } else if (simErr.includes('"Custom":1')) {
            // Show last few logs for context
            const lastLogs = logs.slice(-3).join(" | ");
            friendlyError = `Program error (Custom:1). Logs: ${lastLogs || 'none'}`;
          } else if (simErr.includes('"Custom":0')) {
            friendlyError = "Account already initialized/exists.";
          }

          // Always include raw error for debugging
          console.error("Full simulation result:", JSON.stringify(simulation.value, null, 2));
          throw new Error(`Simulation failed: ${friendlyError}`);
        }
        console.log("Simulation passed, sending transaction...");

        // Send the transaction
        const signature = await connection.sendTransaction(transaction, {
          skipPreflight: true, // Already simulated above
          maxRetries: 3,
        });

        console.log("Transaction sent:", signature);

        // Wait for confirmation
        const confirmation = await connection.confirmTransaction(signature, "confirmed");
        if (confirmation.value.err) {
          // Parse common Solana errors for better messages
          const errStr = JSON.stringify(confirmation.value.err);
          let friendlyError = errStr;

          if (errStr.includes('"Custom":1')) {
            friendlyError = "Insufficient SOL balance or account error. Please add more SOL to your wallet.";
          } else if (errStr.includes('"Custom":0')) {
            friendlyError = "Account already initialized.";
          } else if (errStr.includes('InsufficientFunds')) {
            friendlyError = "Insufficient SOL balance. Please add more SOL to your wallet.";
          }

          throw new Error(friendlyError);
        }

        return signature;
      } catch (error: unknown) {
        // Properly extract error message from various error types
        let errorMessage: string;
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'object' && error !== null) {
          // Try to get message from object or stringify it
          const errObj = error as Record<string, unknown>;
          if ('message' in errObj && typeof errObj.message === 'string') {
            errorMessage = errObj.message;
          } else if ('logs' in errObj && Array.isArray(errObj.logs)) {
            errorMessage = errObj.logs.join('\n');
          } else {
            errorMessage = JSON.stringify(error);
          }
        } else {
          errorMessage = String(error);
        }

        lastError = new Error(errorMessage);
        console.error(`Attempt ${attempt + 1} failed:`, errorMessage);

        // If it's a blockhash error, don't retry
        if (errorMessage.includes("blockhash")) {
          throw lastError;
        }
      }
    }

    throw lastError || new Error("Transaction failed after retries");
  };

  // Save/load launch progress to resume if something fails
  const saveProgress = (data: { tokenMint: string; tokenMetadata: string; configKey: string; configDone: boolean; ticker: string }) => {
    localStorage.setItem('launchProgress', JSON.stringify(data));
  };

  const loadProgress = () => {
    try {
      const saved = localStorage.getItem('launchProgress');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  };

  const clearProgress = () => {
    localStorage.removeItem('launchProgress');
  };

  const handleLaunch = async () => {
    if (!user || !walletAddress) return;
    setLoading(true);
    setStatus("Checking balance...");

    try {
      // Check balance first to avoid wasting fees on doomed attempts
      const connection = new Connection(RPC_URL, "confirmed");
      const balance = await connection.getBalance(getKeypair()!.publicKey);
      const balanceSOL = balance / 1_000_000_000;
      console.log("Current balance:", balanceSOL, "SOL");

      // Need at least 0.05 SOL for all transactions (config + launch)
      if (balanceSOL < 0.03) {
        throw new Error(`Insufficient balance: ${balanceSOL.toFixed(4)} SOL. Need at least 0.03 SOL.`);
      }

      setStatus("Creating your coin...");
      // Check for saved progress from a previous failed attempt
      const savedProgress = loadProgress();
      if (savedProgress && savedProgress.configDone) {
        console.log("Resuming from saved progress:", savedProgress);
        setStatus("Resuming from last attempt...");

        // Skip directly to finalize step
        setStatus("Creating launch transaction...");
        const finalizeRes = await fetch("/api/launch-coin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            privyId: user.id,
            walletAddress: walletAddress,
            step: "finalize",
            tokenMint: savedProgress.tokenMint,
            tokenMetadata: savedProgress.tokenMetadata,
            configKey: savedProgress.configKey,
          }),
        });

        const finalizeData = await finalizeRes.json();
        console.log("Finalize response:", JSON.stringify(finalizeData, null, 2));

        if (!finalizeData.success) {
          // If finalize fails, clear progress and start fresh
          console.log("Resume failed, clearing progress:", finalizeData.error);
          clearProgress();
          throw new Error(finalizeData.error);
        }

        if (!finalizeData.launchTransaction) {
          console.error("No launchTransaction in response:", finalizeData);
          clearProgress();
          throw new Error("Server did not return launch transaction. Keys: " + Object.keys(finalizeData).join(", "));
        }

        // Sign and send launch transaction
        setStatus("Launching token...");
        await signAndSendTransaction(finalizeData.launchTransaction);

        // Confirm
        setStatus("Confirming launch...");
        const confirmRes = await fetch("/api/launch-coin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            privyId: user.id,
            walletAddress: walletAddress,
            step: "confirm",
            tokenMint: savedProgress.tokenMint,
            customTicker: savedProgress.ticker,
          }),
        });

        await confirmRes.json();
        clearProgress();
        setStatus(`Coin launched! ${savedProgress.ticker}`);
        onLaunched?.(savedProgress.tokenMint);
        return;
      }
      // Validate ticker before launch
      const ticker = customTicker.trim();
      if (ticker.length < 2 || ticker.length > 10) {
        throw new Error("Ticker must be 2-10 characters");
      }

      // Convert fee claimers to API format
      const feeClaimersForApi = feeClaimers.length > 0 ? (() => {
        const creatorShare = 100 - feeClaimers.reduce((sum, c) => sum + c.percentage, 0);
        const allClaimers = [
          { wallet: walletAddress, basisPoints: creatorShare * 100 },
          ...feeClaimers.map(c => ({ wallet: c.wallet!, basisPoints: c.percentage * 100 }))
        ];
        return allClaimers;
      })() : undefined;

      // Step 1: Prepare token (create token info + fee config)
      const prepareRes = await fetch("/api/launch-coin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privyId: user.id,
          walletAddress: walletAddress,
          customTicker: ticker,
          feeClaimers: feeClaimersForApi,
        }),
      });

      const prepareData = await prepareRes.json();

      if (prepareData.error === "User already has a coin") {
        setStatus("You already have a coin!");
        onLaunched?.(prepareData.tokenMint);
        return;
      }

      if (!prepareData.success) throw new Error(prepareData.error);

      // Sign and send config transactions (if any)
      // Extract transaction strings if they come as objects
      const rawConfigTxs = prepareData.configTransactions || [];
      console.log("Raw config transactions received:", rawConfigTxs);

      const configTxs: string[] = rawConfigTxs.map((tx: string | { transaction: string }) => {
        if (typeof tx === 'string') return tx;
        if (tx && typeof tx === 'object' && 'transaction' in tx) {
          return tx.transaction;
        }
        return null;
      }).filter((t: string | null): t is string => t !== null);

      console.log("Extracted config transactions:", configTxs.length);

      if (configTxs.length > 0) {
        console.log(`Starting to sign ${configTxs.length} config transactions...`);
        setStatus(`Signing config (${configTxs.length} tx)...`);
        for (let i = 0; i < configTxs.length; i++) {
          const tx = configTxs[i];
          console.log(`Config tx ${i}: type=${typeof tx}, length=${tx?.length || 0}`);
          // Skip if not a valid base64 string
          if (typeof tx !== "string" || tx.length === 0) {
            console.log(`Skipping invalid tx at index ${i}:`, tx);
            continue;
          }
          try {
            console.log(`Signing and sending config tx ${i}...`);
            const sig = await signAndSendTransaction(tx);
            console.log(`Config tx ${i} SUCCESS! Signature:`, sig);
            setStatus(`Config ${i + 1}/${configTxs.length} done`);
          } catch (txError) {
            console.error(`Config tx ${i} FAILED:`, txError);
            let errorMsg = "Unknown error";
            if (txError instanceof Error) {
              errorMsg = txError.message;
            } else if (typeof txError === 'object' && txError !== null) {
              errorMsg = JSON.stringify(txError);
            } else {
              errorMsg = String(txError);
            }
            throw new Error(`Config transaction ${i + 1} failed: ${errorMsg}`);
          }
        }

        // Wait longer for config to be confirmed on-chain
        console.log("All config transactions sent, waiting for confirmation...");
        setStatus("Waiting for config confirmation...");
        await new Promise((resolve) => setTimeout(resolve, 10000));
        console.log("Config confirmation wait complete");

        // Save progress so we can resume if next step fails
        saveProgress({
          tokenMint: prepareData.tokenMint,
          tokenMetadata: prepareData.tokenMetadata,
          configKey: prepareData.configKey,
          configDone: true,
          ticker: ticker,
        });
        console.log("Progress saved for resume");
      } else {
        console.log("No config transactions to sign - configTxs array is empty!");
        // Still save progress even if no config txs needed
        saveProgress({
          tokenMint: prepareData.tokenMint,
          tokenMetadata: prepareData.tokenMetadata,
          configKey: prepareData.configKey,
          configDone: true,
          ticker: ticker,
        });
      }

      // Step 2: Finalize (create launch transaction)
      setStatus("Creating launch transaction...");
      const finalizeRes = await fetch("/api/launch-coin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privyId: user.id,
          walletAddress: walletAddress,
          step: "finalize",
          tokenMint: prepareData.tokenMint,
          tokenMetadata: prepareData.tokenMetadata,
          configKey: prepareData.configKey,
        }),
      });

      const finalizeData = await finalizeRes.json();
      console.log("Finalize response (normal flow):", JSON.stringify(finalizeData, null, 2));

      if (!finalizeData.success) throw new Error(finalizeData.error);

      if (!finalizeData.launchTransaction) {
        console.error("No launchTransaction in response:", finalizeData);
        throw new Error("Server did not return launch transaction. Keys: " + Object.keys(finalizeData).join(", "));
      }

      // Sign and send launch transaction
      setStatus("Launching token...");
      await signAndSendTransaction(finalizeData.launchTransaction);

      // Step 3: Confirm (save to DB)
      setStatus("Confirming launch...");
      const confirmRes = await fetch("/api/launch-coin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privyId: user.id,
          walletAddress: walletAddress,
          step: "confirm",
          tokenMint: prepareData.tokenMint,
          customTicker: ticker,
        }),
      });

      const confirmData = await confirmRes.json();
      if (!confirmData.success) {
        console.error("Confirm failed but token was launched:", confirmData.error);
      }

      clearProgress();
      setStatus(`Coin launched! ${prepareData.tokenSymbol}`);
      onLaunched?.(prepareData.tokenMint);
    } catch (error) {
      console.error("Launch error:", error);
      setStatus(`Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const canLaunch = walletAddress && customTicker.length >= 2 && customTicker.length <= 10 && !tickerError;

  return (
    <div className="space-y-6">
      {/* Ticker Input */}
      <div>
        <label className="block text-sm text-gray-400 mb-2">
          Token Ticker (2-10 characters)
        </label>
        <input
          type="text"
          value={customTicker}
          onChange={handleTickerChange}
          placeholder="e.g. BAGS"
          disabled={loading}
          className="w-full px-4 py-3 rounded-lg bg-white/[0.05] border border-white/[0.1] text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 uppercase disabled:opacity-50"
          maxLength={10}
        />
        {tickerError && (
          <p className="mt-1 text-xs text-red-400">{tickerError}</p>
        )}
        {customTicker && !tickerError && (
          <p className="mt-1 text-xs text-gray-500">
            Your token will be called <span className="text-violet-400 font-medium">${customTicker}</span>
          </p>
        )}
      </div>

      {/* Fee Sharing Configuration */}
      <FeeShareConfig
        onClaimersChange={setFeeClaimers}
        disabled={loading}
      />

      <button
        onClick={handleLaunch}
        disabled={loading || !canLaunch}
        className="w-full py-3 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Launching..." : "Launch Your Coin"}
      </button>
      {status && (
        <p className={`mt-2 text-sm text-center ${status.includes("Failed") ? "text-red-400" : "text-green-400"}`}>
          {status}
        </p>
      )}
      {!walletAddress && (
        <p className="mt-2 text-xs text-gray-500 text-center">
          Loading wallet...
        </p>
      )}
    </div>
  );
}
