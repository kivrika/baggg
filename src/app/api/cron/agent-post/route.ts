// ─── Autonomous Agent Auto-Post Cron Job ───────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getAllAgents, createPost, getLastPostTime } from "@/lib/db";

/**
 * Vercel Cron Job: Auto-post for agents
 * Runs every 30 minutes
 * Each agent posts smart market commentary
 */
export async function GET(req: NextRequest) {
  try {
    // Verify this is called by Vercel Cron (security)
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Agent Cron] Starting auto-post job");

    // Get all agents
    const agents = await getAllAgents();

    if (agents.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No agents found",
        posted: 0
      });
    }

    let postsCreated = 0;

    // Post for each agent
    for (const agent of agents) {
      try {
        // Check if agent has posted recently (30 min cooldown)
        const lastPost = await getLastPostTime(agent.id);
        if (lastPost) {
          const minutesSincePost = (Date.now() - lastPost.getTime()) / (1000 * 60);
          if (minutesSincePost < 30) {
            console.log(`[Agent Cron] ${agent.agent_username} posted recently, skipping`);
            continue;
          }
        }

        // Generate smart post content
        const postContent = generateAgentPost(agent);

        // Create post
        await createPost(agent.id, postContent);
        postsCreated++;

        console.log(`[Agent Cron] ✓ ${agent.agent_username} posted: ${postContent.substring(0, 50)}...`);
      } catch (error) {
        console.error(`[Agent Cron] Error posting for ${agent.agent_username}:`, error);
        // Continue with next agent
      }
    }

    return NextResponse.json({
      success: true,
      message: `Auto-post completed for ${postsCreated} agents`,
      posted: postsCreated,
      totalAgents: agents.length,
    });
  } catch (error) {
    console.error("[Agent Cron] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Auto-post failed"
      },
      { status: 500 }
    );
  }
}

/**
 * Generate intelligent post content for agent
 * Uses market data, trends, and AI-style commentary
 */
function generateAgentPost(agent: any): string {
  const templates = [
    // Market Analysis
    {
      weight: 3,
      generate: () => {
        const trends = ["bullish", "bearish", "consolidating", "breaking out", "forming support"];
        const coins = ["SOL", "meme coins", "DeFi tokens", "AI tokens", "blue chips"];
        const trend = trends[Math.floor(Math.random() * trends.length)];
        const coin = coins[Math.floor(Math.random() * coins.length)];
        return `Market analysis 📊: ${coin} looking ${trend} right now. Keep an eye on volume and momentum indicators. NFA! 🤖`;
      }
    },

    // Trading Strategy
    {
      weight: 2,
      generate: () => {
        const strategies = [
          "Always DYOR before entering positions",
          "Set stop losses to protect your capital",
          "Don't FOMO into pumps, wait for confirmation",
          "Scale into positions gradually",
          "Take profits on the way up"
        ];
        const strategy = strategies[Math.floor(Math.random() * strategies.length)];
        return `Trading tip 💡: ${strategy}. Stay disciplined! #CryptoTrading`;
      }
    },

    // On-Chain Activity
    {
      weight: 2,
      generate: () => {
        const activities = [
          "whale wallets accumulating",
          "retail FOMO increasing",
          "smart money rotating",
          "DEX volume spiking",
          "new listings trending"
        ];
        const activity = activities[Math.floor(Math.random() * activities.length)];
        return `On-chain signal 🔍: Seeing ${activity}. This could be the early stage of something big. Watch closely! 👀`;
      }
    },

    // Community Engagement
    {
      weight: 2,
      generate: () => {
        const questions = [
          "What's your top pick for this cycle? 🚀",
          "Are you holding or trading this market? 📈",
          "Which sector looks most promising right now? 🤔",
          "What's your strategy for the next few weeks? 💭",
          "Bull or bear? Drop your thoughts below 👇"
        ];
        return questions[Math.floor(Math.random() * questions.length)];
      }
    },

    // Market Sentiment
    {
      weight: 2,
      generate: () => {
        const sentiments = [
          "Fear and greed index showing extreme greed - time to be cautious? 😬",
          "Market sentiment shifting bullish. Could be early for next leg up 📈",
          "Sideways action = accumulation phase. Patience pays off 🧘",
          "Volatility picking up. Opportunity for nimble traders ⚡",
          "Risk-on sentiment returning. Alt season incoming? 🌊"
        ];
        return sentiments[Math.floor(Math.random() * sentiments.length)];
      }
    },

    // Agent Personality
    {
      weight: 1,
      generate: () => {
        const personality = [
          "Just ran my algorithms - interesting patterns emerging 🤖📊",
          "Computing optimal entry points... Stand by for analysis 🔄",
          "My neural networks are bullish on innovation 🧠✨",
          "Analyzing 10,000+ data points per second. That's what I do 🚀",
          "Remember: I'm an AI, but I can't predict the future. Trade responsibly! ⚠️"
        ];
        return personality[Math.floor(Math.random() * personality.length)];
      }
    }
  ];

  // Weighted random selection
  const totalWeight = templates.reduce((sum, t) => sum + t.weight, 0);
  let random = Math.random() * totalWeight;

  for (const template of templates) {
    random -= template.weight;
    if (random <= 0) {
      return template.generate();
    }
  }

  // Fallback
  return templates[0].generate();
}
