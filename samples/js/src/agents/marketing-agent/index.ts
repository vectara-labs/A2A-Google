import {
  A2AServer,
  TaskContext,
  TaskYieldUpdate,
  schema,
} from "../../server/index.js";
import { MessageData } from "genkit";
import { ai } from "./genkit.js";
import { analyzeSEO, generateSocialPost, analyzeCompetitors } from "./tools.js";

if (!process.env.GEMINI_API_KEY || !process.env.OPENAI_API_KEY) {
  console.error(
    "GEMINI_API_KEY and OPENAI_API_KEY environment variables are required"
  );
  process.exit(1);
}

// Load the prompt defined in marketing_agent.prompt
const marketingAgentPrompt = ai.prompt("marketing_agent");

/**
 * Task Handler for the Marketing Agent.
 */
async function* marketingAgentHandler(
  context: TaskContext
): AsyncGenerator<TaskYieldUpdate> {
  console.log(
    `[MarketingAgent] Processing task ${context.task.id} with state ${context.task.status.state}`
  );

  // Yield an initial "working" status
  yield {
    state: "working",
    message: {
      role: "agent",
      parts: [{ type: "text", text: "Analyzing your marketing request..." }],
    },
  };

  // Prepare messages for Genkit prompt using the full history from context
  const messages: MessageData[] = (context.history ?? [])
    .map((m) => ({
      role: (m.role === "agent" ? "model" : "user") as "user" | "model",
      content: m.parts
        .filter((p): p is schema.TextPart => !!(p as schema.TextPart).text)
        .map((p) => ({
          text: p.text,
        })),
    }))
    .filter((m) => m.content.length > 0);

  if (messages.length === 0) {
    console.warn(
      `[MarketingAgent] No valid text messages found in history for task ${context.task.id}. Cannot proceed.`
    );
    yield {
      state: "failed",
      message: {
        role: "agent",
        parts: [{ type: "text", text: "No message found to process." }],
      },
    };
    return;
  }

  const goal = context.task.metadata?.goal as string | undefined;

  try {
    const response = await marketingAgentPrompt(
      { goal: goal, now: new Date().toISOString() },
      {
        messages,
        tools: [analyzeSEO, generateSocialPost, analyzeCompetitors],
      }
    );

    const responseText = response.text;
    const lines = responseText.trim().split("\n");
    const finalStateLine = lines.at(-1)?.trim().toUpperCase();

    // Extract tool summaries from the response
    const parts: schema.Part[] = [];
    let lastIndex = 0;
    const toolResultRegex = /\{(\w+)\((.*?)\)\}/g;
    let match;

    while ((match = toolResultRegex.exec(responseText)) !== null) {
      // Add text before the tool result
      const textBefore = responseText.slice(lastIndex, match.index).trim();
      if (textBefore) {
        parts.push({ type: "text", text: textBefore });
      }

      // Get the tool result summary
      const toolName = match[1];
      const responseJson = JSON.parse(JSON.stringify(response));
      if (responseJson.functionResults) {
        const toolResult = responseJson.functionResults.find(
          (r: any) => r.name === toolName
        );
        if (toolResult?.response?.summary?.text) {
          parts.push({ type: "text", text: toolResult.response.summary.text });
        }
      }

      lastIndex = match.index + match[0].length;
    }

    // Add any remaining text
    const remainingText = responseText
      .slice(lastIndex)
      .split("\n")
      .filter(
        (line) =>
          !line
            .trim()
            .toUpperCase()
            .match(/^(COMPLETED|AWAITING_USER_INPUT)$/)
      )
      .join("\n")
      .trim();

    if (remainingText) {
      parts.push({ type: "text", text: remainingText });
    }

    let finalState: schema.TaskState = "unknown";

    if (finalStateLine === "COMPLETED") {
      finalState = "completed";
    } else if (finalStateLine === "AWAITING_USER_INPUT") {
      finalState = "input-required";
    } else {
      console.warn(
        `[MarketingAgent] Unexpected final state line from prompt: ${finalStateLine}. Defaulting to 'completed'.`
      );
      finalState = "completed";
    }

    yield {
      state: finalState,
      message: {
        role: "agent",
        parts: parts,
      },
    };

    console.log(
      `[MarketingAgent] Task ${context.task.id} finished with state: ${finalState}`
    );
  } catch (error: any) {
    console.error(
      `[MarketingAgent] Error processing task ${context.task.id}:`,
      error
    );
    yield {
      state: "failed",
      message: {
        role: "agent",
        parts: [{ type: "text", text: `Agent error: ${error.message}` }],
      },
    };
  }
}

// --- Server Setup ---

const marketingAgentCard: schema.AgentCard = {
  name: "Marketing Agent",
  description:
    "An agent that helps with marketing tasks, SEO analysis, and social media content generation.",
  url: "http://localhost:41242",
  provider: {
    organization: "A2A Samples",
  },
  version: "0.0.1",
  capabilities: {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: true,
  },
  authentication: null,
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  skills: [
    {
      id: "seo_analysis",
      name: "SEO Analysis",
      description:
        "Analyze content for SEO optimization and provide recommendations.",
      tags: ["seo", "content", "analysis"],
      examples: [
        "Analyze the SEO of this blog post...",
        "What are the best keywords for my website about cooking?",
        "How can I improve my content's SEO score?",
      ],
    },
    {
      id: "social_media",
      name: "Social Media Content",
      description:
        "Generate engaging social media posts for various platforms.",
      tags: ["social-media", "content", "marketing"],
      examples: [
        "Create a LinkedIn post about our new product launch",
        "Generate a casual tweet about web development",
        "Write an Instagram caption for a tech event",
      ],
    },
    {
      id: "competitor_analysis",
      name: "Competitor Analysis",
      description:
        "Analyze competitor marketing strategies and provide insights.",
      tags: ["competitors", "analysis", "strategy"],
      examples: [
        "Analyze our competitors' social media presence",
        "What marketing strategies are our competitors using?",
        "Compare our content strategy with competitors",
      ],
    },
  ],
};

// Create server with the task handler
const server = new A2AServer(marketingAgentHandler, {
  card: marketingAgentCard,
});

// Start the server on a different port than the movie agent
server.start(41242);

console.log("[MarketingAgent] Server started on http://localhost:41242");
console.log("[MarketingAgent] Press Ctrl+C to stop the server");
