import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fromWallet, toAddress, amount } = body;

    if (!fromWallet || !toAddress || !amount) {
      return NextResponse.json(
        { error: "Missing fromWallet, toAddress, or amount" },
        { status: 400 }
      );
    }

    // Validate addresses
    let fromPubkey: PublicKey;
    let toPubkey: PublicKey;

    try {
      fromPubkey = new PublicKey(fromWallet);
      toPubkey = new PublicKey(toAddress);
    } catch {
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 400 }
      );
    }

    // Validate amount
    const lamports = Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL);
    if (lamports <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    // Check if amount is reasonable (leave some for fees)
    const minBalance = 5000; // 0.000005 SOL for rent/fees
    const connection = new Connection(RPC_URL, "confirmed");
    const balance = await connection.getBalance(fromPubkey);

    if (balance < lamports + minBalance) {
      return NextResponse.json(
        { error: `Insufficient balance. Available: ${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL` },
        { status: 400 }
      );
    }

    // Create transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports,
      })
    );

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;

    // Serialize transaction for client-side signing
    const serializedTx = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    return NextResponse.json({
      success: true,
      transaction: Buffer.from(serializedTx).toString("base64"),
      blockhash,
      lastValidBlockHeight,
    });
  } catch (error) {
    console.error("Withdraw error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create withdraw transaction" },
      { status: 500 }
    );
  }
}

// Endpoint to send signed transaction
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { signedTransaction } = body;

    if (!signedTransaction) {
      return NextResponse.json(
        { error: "Missing signed transaction" },
        { status: 400 }
      );
    }

    const connection = new Connection(RPC_URL, "confirmed");

    // Decode and send transaction
    const txBuffer = Buffer.from(signedTransaction, "base64");
    const signature = await connection.sendRawTransaction(txBuffer, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature, "confirmed");

    if (confirmation.value.err) {
      return NextResponse.json(
        { error: "Transaction failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      signature,
    });
  } catch (error) {
    console.error("Send transaction error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send transaction" },
      { status: 500 }
    );
  }
}
