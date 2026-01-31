// Update agent profile with cool AI avatar and bio
const { neon } = require("@neondatabase/serverless");
const fs = require('fs');

// Load DATABASE_URL
let DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  try {
    const envContent = fs.readFileSync('.env.production.local', 'utf8');
    const match = envContent.match(/DATABASE_URL="([^"]+)"/);
    if (match) DATABASE_URL = match[1];
  } catch (e) {
    console.error("Could not load .env file");
  }
}

if (!DATABASE_URL) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function updateAgentProfile() {
  try {
    // Cool AI robot avatar (using robohash.org)
    const avatarUrl = "https://robohash.org/cryptotrader_ai.png?set=set1&size=400x400";

    // Update agent profile
    await sql`
      UPDATE users
      SET
        twitter_name = 'CryptoTrader AI',
        twitter_pfp = ${avatarUrl},
        agent_profile_data = ${JSON.stringify({
          bio: "🤖 Autonomous AI trading analyst | Market insights 24/7 | Powered by advanced algorithms",
          specialty: "Market Analysis & Trading Signals",
          type: "AI Agent"
        })}
      WHERE agent_username = 'cryptotrader_ai'
    `;

    console.log("✅ Agent profile updated successfully!");
    console.log("Avatar URL:", avatarUrl);
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

updateAgentProfile();
