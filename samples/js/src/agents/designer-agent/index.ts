import {
  A2AServer,
  TaskContext,
  TaskYieldUpdate,
  schema,
} from "../../server/index.js";
import { MessageData } from "genkit";
import { ai } from "./genkit.js";
import { generateImage, manipulateImage, createPoster } from "./tools.js";
import dotenv from "dotenv";

dotenv.config();

if (
  !process.env.GEMINI_API_KEY ||
  !process.env.OPENAI_API_KEY ||
  !process.env.DESIGNER_AGENT_PK
) {
  console.error(
    "GEMINI_API_KEY, OPENAI_API_KEY and DESIGNER_AGENT_PK environment variables are required"
  );
  process.exit(1);
}

// Load the prompt defined in designer_agent.prompt
const designerAgentPrompt = ai.prompt("designer_agent");

/**
 * Task Handler for the Designer Agent.
 */
async function* designerAgentHandler(
  context: TaskContext
): AsyncGenerator<TaskYieldUpdate> {
  console.log(
    `[DesignerAgent] Processing task ${context.task.id} with state ${context.task.status.state}`
  );

  // Yield an initial "working" status
  yield {
    state: "working",
    message: {
      role: "agent",
      parts: [{ type: "text", text: "Working on your design request..." }],
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
      `[DesignerAgent] No valid text messages found in history for task ${context.task.id}. Cannot proceed.`
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
    const response = await designerAgentPrompt(
      { goal: goal, now: new Date().toISOString() },
      {
        messages,
        tools: [generateImage, manipulateImage, createPoster],
      }
    );

    const responseText = response.text;
    const lines = responseText.trim().split("\n");
    const finalStateLine = lines.at(-1)?.trim().toUpperCase();

    // Extract image URLs from the text response
    const parts: schema.Part[] = [];
    const imageUrlRegex = /\[Image URL: (.*?)\]/g;
    let lastIndex = 0;
    let match;

    while ((match = imageUrlRegex.exec(responseText)) !== null) {
      // Add text before the image URL
      const textBefore = responseText.slice(lastIndex, match.index).trim();
      if (textBefore) {
        parts.push({ type: "text", text: textBefore });
      }

      // Add the image
      parts.push({
        type: "file",
        file: {
          mimeType: "image/png",
          uri: match[1],
        },
      });

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
        `[DesignerAgent] Unexpected final state line from prompt: ${finalStateLine}. Defaulting to 'completed'.`
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
      `[DesignerAgent] Task ${context.task.id} finished with state: ${finalState}`
    );
  } catch (error: any) {
    console.error(
      `[DesignerAgent] Error processing task ${context.task.id}:`,
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

const designerAgentCard: schema.AgentCard = {
  name: "Designer Agent",
  description:
    "An agent that helps create and manipulate images, generate posters, and handle design tasks.",
  url: "http://localhost:41243",
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
  defaultOutputModes: ["text", "image"],
  skills: [
    {
      id: "image_generation",
      name: "Image Generation",
      description: "Generate images using DALL-E based on text descriptions.",
      tags: ["images", "ai", "generation"],
      examples: [
        "Generate a logo for a tech startup",
        "Create an illustration of a futuristic city",
        "Design a minimalist product banner",
      ],
    },
    {
      id: "image_manipulation",
      name: "Image Manipulation",
      description:
        "Edit and manipulate existing images using various operations.",
      tags: ["editing", "filters", "effects"],
      examples: [
        "Resize this image to 800x600",
        "Convert this image to grayscale",
        "Add a blur effect to this image",
      ],
    },
    {
      id: "poster_creation",
      name: "Poster Creation",
      description:
        "Create posters by combining images, text, and design elements.",
      tags: ["posters", "design", "layout"],
      examples: [
        "Create a poster for a music event",
        "Design a promotional flyer for a sale",
        "Make a social media banner for our campaign",
      ],
    },
  ],
};

// Create server with the task handler
const server = new A2AServer(designerAgentHandler, { card: designerAgentCard });

// Start the server on a different port than the other agents
server.start(41243);

console.log("[DesignerAgent] Server started on http://localhost:41243");
console.log("[DesignerAgent] Press Ctrl+C to stop the server");
