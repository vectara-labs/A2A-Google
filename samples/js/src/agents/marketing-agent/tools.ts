import { ai, z } from "./genkit.js";

export const analyzeSEO = ai.defineTool(
  {
    name: "analyzeSEO",
    description:
      "Analyze content for SEO optimization and provide recommendations",
    inputSchema: z.object({
      content: z.string(),
      targetKeywords: z.array(z.string()).optional(),
    }),
  },
  async ({ content, targetKeywords }) => {
    console.log("[seo:analyze]", {
      contentLength: content.length,
      targetKeywords,
    });

    // Simple SEO analysis (you can enhance this with actual SEO libraries)
    const readabilityScore = calculateReadabilityScore(content);
    const keywordDensity = targetKeywords
      ? analyzeKeywordDensity(content, targetKeywords)
      : {};
    const recommendations = generateSEORecommendations(content);
    const wordCount = content.split(/\s+/).length;

    return {
      contentLength: wordCount,
      readabilityScore,
      keywordDensity,
      recommendations,
      summary: {
        text: `Content Analysis:
- Length: ${wordCount} words
- Readability Score: ${readabilityScore}/100
${Object.entries(keywordDensity)
  .map(([keyword, density]) => `- Keyword "${keyword}": ${density.toFixed(2)}%`)
  .join("\n")}

Recommendations:
${recommendations.map((rec) => `- ${rec}`).join("\n")}`,
      },
    };
  }
);

export const generateSocialPost = ai.defineTool(
  {
    name: "generateSocialPost",
    description: "Generate social media post content for different platforms",
    inputSchema: z.object({
      topic: z.string(),
      platform: z.enum(["twitter", "linkedin", "facebook", "instagram"]),
      tone: z.enum(["professional", "casual", "humorous", "formal"]).optional(),
    }),
  },
  async ({ topic, platform, tone = "professional" }) => {
    console.log("[social:generate]", { topic, platform, tone });

    // Use OpenAI to generate the post (you'll need to implement the actual API call)
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are a social media expert. Generate a ${tone} post for ${platform} about: ${topic}`,
          },
        ],
        max_tokens: 150,
      }),
    });

    const data = await response.json();
    const content = data.choices[0].message.content;
    const hashtags = generateRelevantHashtags(topic, platform);

    return {
      platform,
      content,
      hashtags,
      summary: {
        text: `Generated Post:
${content}

Suggested Hashtags:
${hashtags.join(" ")}`,
      },
    };
  }
);

export const analyzeCompetitors = ai.defineTool(
  {
    name: "analyzeCompetitors",
    description: "Analyze competitor content and marketing strategies",
    inputSchema: z.object({
      competitors: z.array(z.string()),
      aspect: z.enum(["content", "social-media", "seo", "overall"]),
    }),
  },
  async ({ competitors, aspect }) => {
    console.log("[competitors:analyze]", { competitors, aspect });

    // This would typically involve web scraping and API calls to various services
    // For now, we'll return a mock analysis
    const analysis = competitors.map((competitor) => ({
      name: competitor,
      strengths: ["Example strength 1", "Example strength 2"],
      weaknesses: ["Example weakness 1", "Example weakness 2"],
      opportunities: ["Example opportunity 1", "Example opportunity 2"],
    }));

    const recommendations = [
      "Focus on unique value proposition",
      "Improve content frequency",
      "Engage more on social media",
    ];

    return {
      competitorAnalysis: analysis,
      recommendations,
      summary: {
        text: `Competitor Analysis:

${analysis
  .map(
    (comp) => `${comp.name}:
- Strengths:
  * ${comp.strengths.join("\n  * ")}
- Weaknesses:
  * ${comp.weaknesses.join("\n  * ")}
- Opportunities:
  * ${comp.opportunities.join("\n  * ")}
`
  )
  .join("\n")}
Key Recommendations:
${recommendations.map((rec, i) => `${i + 1}. ${rec}`).join("\n")}`,
      },
    };
  }
);

// Helper functions
function calculateReadabilityScore(content: string): number {
  // Implement Flesch-Kincaid or similar readability scoring
  // This is a simplified version
  const words = content.split(/\s+/).length;
  const sentences = content.split(/[.!?]+/).length;
  const syllables = countSyllables(content);

  return Math.round(
    206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)
  );
}

function countSyllables(text: string): number {
  // Simplified syllable counting
  return text
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/[^aeiou]+/g, " ")
    .trim().length;
}

function analyzeKeywordDensity(
  content: string,
  keywords: string[]
): Record<string, number> {
  const wordCount = content.split(/\s+/).length;
  const densities: Record<string, number> = {};

  keywords.forEach((keyword) => {
    const regex = new RegExp(keyword, "gi");
    const matches = content.match(regex) || [];
    densities[keyword] = (matches.length / wordCount) * 100;
  });

  return densities;
}

function generateSEORecommendations(content: string): string[] {
  const recommendations = [];

  if (content.length < 300) {
    recommendations.push("Increase content length to at least 300 words");
  }
  if (!content.includes("<h1>")) {
    recommendations.push("Add an H1 heading");
  }
  if (!content.includes("<meta")) {
    recommendations.push("Add meta description");
  }

  return recommendations;
}

function generateRelevantHashtags(topic: string, platform: string): string[] {
  // This would typically use an API or more sophisticated analysis
  // For now, returning mock hashtags
  const baseHashtags = topic
    .toLowerCase()
    .split(" ")
    .map((word) => `#${word.replace(/[^a-z0-9]/g, "")}`);

  return [...baseHashtags, "#marketing", `#${platform}`];
}
