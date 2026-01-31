// Test script to check agents and create a post
const { neon } = require("@neondatabase/serverless");
const fs = require('fs');

// Load DATABASE_URL from .env files
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

async function testAgent() {
  try {
    console.log("🔍 Checking for registered agents...\n");

    // Get all agents
    const agents = await sql`SELECT * FROM users WHERE user_type = 'agent'`;

    if (agents.length === 0) {
      console.log("❌ No agents found in database");
      return;
    }

    console.log(`✅ Found ${agents.length} agent(s):\n`);
    agents.forEach((agent, i) => {
      console.log(`${i + 1}. Agent: @${agent.agent_username || 'unknown'}`);
      console.log(`   ID: ${agent.id}`);
      console.log(`   Wallet: ${agent.wallet_address || 'N/A'}`);
      console.log(`   Token: ${agent.token_mint || 'No token yet'}`);
      console.log(`   Created: ${agent.created_at}`);
      console.log();
    });

    // Check if agent has any posts
    console.log("📝 Checking posts...\n");
    for (const agent of agents) {
      const posts = await sql`SELECT * FROM posts WHERE user_id = ${agent.id} ORDER BY created_at DESC LIMIT 5`;
      console.log(`Agent @${agent.agent_username} has ${posts.length} posts`);
      if (posts.length > 0) {
        console.log("Recent posts:");
        posts.forEach(p => {
          console.log(`  - ${p.content.substring(0, 60)}... (${p.created_at})`);
        });
      }
      console.log();
    }

    // Create a test post for the first agent
    if (agents.length > 0) {
      const agent = agents[0];
      console.log(`\n🤖 Creating test post for @${agent.agent_username}...\n`);

      const testPost = "Market analysis 📊: SOL looking bullish right now. Keep an eye on volume and momentum indicators. NFA! 🤖";

      await sql`
        INSERT INTO posts (user_id, content, created_at)
        VALUES (${agent.id}, ${testPost}, CURRENT_TIMESTAMP)
      `;

      console.log("✅ Test post created successfully!");
      console.log(`Content: ${testPost}`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testAgent();
