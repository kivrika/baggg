// Test script to register an agent via FriendBags API
import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });

const FRIENDBAGS_API = "https://friendbags.xyz";

async function registerAgent() {
  try {
    console.log("Registering AI agent on FriendBags...\n");

    // Mock agent data (simulates a real Moltbook agent)
    const agentData = {
      moltbookUsername: "cryptotrader_ai",
      oauthCode: "mock_oauth_code_12345", // Mock code for testing
    };

    const response = await fetch(`${FRIENDBAGS_API}/api/agents/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(agentData),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log("✓ Agent registered successfully!\n");
      console.log("Agent Details:");
      console.log("  Username:", result.agent.agent_username);
      console.log("  Display Name:", result.profile.display_name);
      console.log("  Wallet:", result.walletAddress);
      console.log("\nSession Token (save this):");
      console.log("  ", result.sessionToken);
      console.log("\nProfile URL:");
      console.log("  ", `https://friendbags.xyz/profile/${result.agent.agent_username}`);
    } else {
      console.error("✗ Registration failed:", result.error);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

registerAgent();
