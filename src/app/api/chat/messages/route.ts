import { NextRequest, NextResponse } from "next/server";
import { getUserByPrivyId, getUserByTwitter, getUserByAgentUsername, getChatSettings, getInboxMessages, createMessage } from "@/lib/db";
import { Connection, PublicKey } from "@solana/web3.js";
import { authenticateAgent } from "@/middleware/agent-auth";
import { getUserUsername } from "@/lib/user-utils";

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

// GET: Get inbox messages for authenticated user (human or agent)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const privyId = searchParams.get("privyId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Try agent authentication first
    const agent = await authenticateAgent(req);
    let user;

    if (agent) {
      user = agent;
      console.log(`[Messages] Agent ${agent.agent_username} fetching inbox`);
    } else {
      if (!privyId) {
        return NextResponse.json({ error: "Missing privyId or agent authentication" }, { status: 400 });
      }

      user = await getUserByPrivyId(privyId);
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
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

// POST: Send a message (requires EITHER party to hold the other's tokens)
// Supports both humans and agents
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { privyId, recipientUsername, content } = body;

    // Validate content
    if (!recipientUsername || !content) {
      return NextResponse.json({ error: "Missing recipientUsername or content" }, { status: 400 });
    }

    if (content.length > 1000) {
      return NextResponse.json({ error: "Message too long (max 1000 characters)" }, { status: 400 });
    }

    // Try agent authentication first
    const agent = await authenticateAgent(req);
    let sender;

    if (agent) {
      sender = agent;
      console.log(`[Messages] Agent ${agent.agent_username} sending message`);
    } else {
      if (!privyId) {
        return NextResponse.json({ error: "Missing privyId or agent authentication" }, { status: 400 });
      }

      sender = await getUserByPrivyId(privyId);
      if (!sender) {
        return NextResponse.json({ error: "Sender not found" }, { status: 404 });
      }
    }

    // Get recipient - try both Twitter username and agent username
    let recipient = await getUserByTwitter(recipientUsername);
    if (!recipient) {
      // Try as agent username
      recipient = await getUserByAgentUsername(recipientUsername);
    }

    if (!recipient) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    // At least one user must have a token for messaging to work
    if (!sender.token_mint && !recipient.token_mint) {
      return NextResponse.json({ error: "Neither user has a token" }, { status: 400 });
    }

    // Check bidirectional token holdings:
    // Case 1: Sender holds recipient's tokens (sender can message recipient)
    // Case 2: Recipient holds sender's tokens (sender can message recipient)

    let canMessage = false;
    let errorDetails = { senderBalance: 0, recipientBalance: 0, senderRequired: 0, recipientRequired: 0 };

    // Case 1: Check if sender holds enough of recipient's tokens
    if (recipient.token_mint && sender.wallet_address) {
      const recipientChatSettings = await getChatSettings(recipient.id);

      // Check if recipient's chat is enabled
      if (!recipientChatSettings || recipientChatSettings.is_enabled !== false) {
        const minTokenAmount = recipientChatSettings ? parseFloat(recipientChatSettings.min_token_amount) : 0;
        const senderBalance = await getTokenBalance(sender.wallet_address, recipient.token_mint);

        errorDetails.senderBalance = senderBalance;
        errorDetails.senderRequired = minTokenAmount;

        if (senderBalance >= minTokenAmount) {
          canMessage = true;
        }
      }
    }

    // Case 2: Check if recipient holds enough of sender's tokens
    if (!canMessage && sender.token_mint && recipient.wallet_address) {
      const senderChatSettings = await getChatSettings(sender.id);

      // Check if sender's chat is enabled (for receiving)
      if (!senderChatSettings || senderChatSettings.is_enabled !== false) {
        const minTokenAmount = senderChatSettings ? parseFloat(senderChatSettings.min_token_amount) : 0;
        const recipientBalance = await getTokenBalance(recipient.wallet_address, sender.token_mint);

        errorDetails.recipientBalance = recipientBalance;
        errorDetails.recipientRequired = minTokenAmount;

        if (recipientBalance >= minTokenAmount) {
          canMessage = true;
        }
      }
    }

    if (!canMessage) {
      // Build error message
      let errorMsg = "Cannot message this user. ";

      if (recipient.token_mint) {
        errorMsg += `You need ${errorDetails.senderRequired} ${recipient.token_symbol || 'tokens'} (you have ${errorDetails.senderBalance}). `;
      }
      if (sender.token_mint) {
        errorMsg += `Or they need ${errorDetails.recipientRequired} ${sender.token_symbol || 'tokens'} (they have ${errorDetails.recipientBalance}).`;
      }

      return NextResponse.json({
        error: errorMsg.trim(),
        details: errorDetails,
      }, { status: 403 });
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
