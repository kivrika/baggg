"use client";

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const WALLET_STORAGE_KEY = "friendbags_wallet";

export interface StoredWallet {
  publicKey: string;
  secretKey: string; // base58 encoded
}

export function getStoredWallet(): StoredWallet | null {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem(WALLET_STORAGE_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as StoredWallet;
  } catch {
    return null;
  }
}

export function createAndStoreWallet(): StoredWallet {
  const keypair = Keypair.generate();

  const wallet: StoredWallet = {
    publicKey: keypair.publicKey.toBase58(),
    secretKey: bs58.encode(keypair.secretKey),
  };

  localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(wallet));

  return wallet;
}

export function getOrCreateWallet(): StoredWallet {
  const existing = getStoredWallet();
  if (existing) return existing;

  return createAndStoreWallet();
}

export function getKeypair(): Keypair | null {
  const wallet = getStoredWallet();
  if (!wallet) return null;

  try {
    const secretKey = bs58.decode(wallet.secretKey);
    return Keypair.fromSecretKey(secretKey);
  } catch {
    return null;
  }
}

export function clearWallet(): void {
  localStorage.removeItem(WALLET_STORAGE_KEY);
}
