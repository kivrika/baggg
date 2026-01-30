import { NextRequest, NextResponse } from "next/server";
import { getUserByPrivyId, getUserByTwitter, getChatSettings, getInboxMessages, createMessage } from "@/lib/db";
import { Connection, PublicKey } from "@solana/web3.js";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

// Helper to get token balance
async function getTokenBalance(wallet: string, tokenMint: string): Promise<number> {
  try {
    const connection = new Connection(RPC_URL, "confirmed");
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(wallet),
      { mint: new PublicKey(tokenMint) }
    );

    if (tokenAccounts.value.length === 0) return 0;

    const accountInfo = tokenAccounts.value[0].account.data.parsed.info;
    return accountInfo.tokenAmount.uiAmount || 0;
  } catch (error) {
    console.error("Error getting token balance:", error);
    return 0;
  }
}

// GET: Get inbox messages for authenticated user
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const privyId = searchParams.get("privyId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!privyId) {
      return NextResponse.json({ error: "Missing privyId" }, { status: 400 });
    }

    const user = await getUserByPrivyId(privyId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const messages = await getInboxMessages(user.id, limit, offset);

    return NextResponse.json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error("Get inbox messages error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get messages" },
      { status: 500 }
    );
  }
}

// POST: Send a message (requires holding recipient's tokens OR being a creator replying)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { privyId, recipientUsername, content } = body;

    if (!privyId || !recipientUsername || !content) {
      return NextResponse.json({ error: "Missing privyId, recipientUsername, or content" }, { status: 400 });
    }

    // Validate content length
    if (content.length > 1000) {
      return NextResponse.json({ error: "Message too long (max 1000 characters)" }, { status: 400 });
    }

    // Get sender
    const sender = await getUserByPrivyId(privyId);
    if (!sender) {
      return NextResponse.json({ error: "Sender not found" }, { status: 404 });
    }

    // Get recipient
    const recipient = await getUserByTwitter(recipientUsername);
    if (!recipient) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    // Check if sender is a creator replying to someone who messaged them
    // Creator can reply if: they have a coin AND recipient has previously messaged them
    let isCreatorReplying = false;
    if (sender.token_mint) {
      // Check if recipient has previously sent messages to sender
      const { hasMessaged } = await import("@/lib/db").then(m => ({ hasMessaged: m.hasMessaged }));
      isCreatorReplying = await hasMessaged(recipient.id, sender.id);
    }

    // If not a creator replying, enforce token requirements
    if (!isCreatorReplying) {
      if (!sender.wallet_address) {
        return NextResponse.json({ error: "Sender wallet not set" }, { status: 400 });
      }

      if (!recipient.token_mint) {
        return NextResponse.json({ error: "Recipient has no token" }, { status: 400 });
      }

      // Get recipient's chat settings
      const chatSettings = await getChatSettings(recipient.id);

      // Check if chat is enabled
      if (chatSettings && !chatSettings.is_enabled) {
        return NextResponse.json({ error: "This user has disabled chat" }, { status: 403 });
      }

      // Get required token amount (default 0 if no settings)
      const minTokenAmount = chatSettings ? parseFloat(chatSettings.min_token_amount) : 0;

      // Verify sender's token balance
      if (minTokenAmount > 0) {
        const balance = await getTokenBalance(sender.wallet_address, recipient.token_mint);

        if (balance < minTokenAmount) {
          return NextResponse.json({
            error: `You need at least ${minTokenAmount} ${recipient.token_symbol || 'tokens'} to message this user. Your balance: ${balance}`,
            required: minTokenAmount,
            balance: balance,
          }, { status: 403 });
        }
      }
    }

    // Create the message
    const message = await createMessage(sender.id, recipient.id, content.trim());

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send message" },
      { status: 500 }
    );
  }
}
