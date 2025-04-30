import { ai, z } from "./genkit.js";
import sharp from "sharp";
import fetch from "node-fetch";
import fs from "fs/promises";
import path from "path";

// Ensure output directory exists
const outputDir = path.join(process.cwd(), "output");
fs.mkdir(outputDir, { recursive: true }).catch(console.error);

export const generateImage = ai.defineTool(
  {
    name: "generateImage",
    description:
      "Generate an image using DALL-E. Provide a detailed description of what you want to generate.",
    inputSchema: z.object({
      prompt: z.string(),
    }),
  },
  async ({ prompt }) => {
    console.log("[dalle:generate]", { prompt });

    try {
      const response = await fetch(
        "https://api.openai.com/v1/images/generations",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "dall-e-3",
            prompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
            style: "vivid",
          }),
        }
      );

      const data: any = await response.json();
      const imageUrl = data.data[0].url;

      // Download and save the image
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.buffer();
      const filename = `dalle_${Date.now()}.png`;
      const filepath = path.join(outputDir, filename);
      await fs.writeFile(filepath, imageBuffer);

      // Return both the file info and a properly formatted file part
      return {
        url: imageUrl,
        filepath,
        prompt,
        filePart: {
          type: "file" as const,
          file: {
            mimeType: "image/png",
            uri: imageUrl,
          },
        },
      };
    } catch (error) {
      console.error("Error generating image:", error);
      throw error;
    }
  }
);

export const manipulateImage = ai.defineTool(
  {
    name: "manipulateImage",
    description:
      "Manipulate an image using Sharp.js. Provide a command string like 'resize 800x600' or 'rotate 90' or 'grayscale'",
    inputSchema: z.object({
      inputPath: z.string(),
      command: z.string(),
    }),
  },
  async ({ inputPath, command }) => {
    console.log("[sharp:manipulate]", { inputPath, command });

    try {
      let image = sharp(inputPath);
      const parts = command.toLowerCase().trim().split(" ");
      const operation = parts[0];
      const params = parts[1];

      switch (operation) {
        case "resize": {
          const [width, height] = params.split("x").map(Number);
          image = image.resize(width, height);
          break;
        }
        case "rotate": {
          const angle = parseInt(params);
          image = image.rotate(angle);
          break;
        }
        case "flip":
          image = image.flip();
          break;
        case "flop":
          image = image.flop();
          break;
        case "blur": {
          const sigma = parseFloat(params) || 1;
          image = image.blur(sigma);
          break;
        }
        case "sharpen": {
          const sigma = parseFloat(params) || 1;
          image = image.sharpen(sigma);
          break;
        }
        case "grayscale":
          image = image.grayscale();
          break;
        case "tint": {
          image = image.tint(params);
          break;
        }
      }

      // Save the processed image
      const filename = `processed_${Date.now()}.png`;
      const outputPath = path.join(outputDir, filename);
      await image.toFile(outputPath);

      return {
        outputPath,
        operation,
        command,
      };
    } catch (error) {
      console.error("Error manipulating image:", error);
      throw error;
    }
  }
);

export const createPoster = ai.defineTool(
  {
    name: "createPoster",
    description:
      "Create a poster with text and images. Provide a JSON string with the poster configuration including width, height, backgroundColor, and elements array.",
    inputSchema: z.object({
      config: z.string(),
    }),
  },
  async ({ config }) => {
    const posterConfig = JSON.parse(config);
    console.log("[sharp:poster]", posterConfig);

    try {
      // Create base canvas
      let poster = sharp({
        create: {
          width: posterConfig.width,
          height: posterConfig.height,
          channels: 4,
          background: posterConfig.backgroundColor,
        },
      });

      // If background image is provided, use it
      if (posterConfig.backgroundImage) {
        poster = sharp(posterConfig.backgroundImage).resize(
          posterConfig.width,
          posterConfig.height
        );
      }

      // Prepare composite operations for all elements
      const compositeOperations = posterConfig.elements
        .filter((element) => element.type === "image")
        .map((element) => ({
          input: element.content,
          top: element.y,
          left: element.x,
        }));

      if (compositeOperations.length > 0) {
        poster = poster.composite(compositeOperations);
      }

      // Save the poster
      const filename = `poster_${Date.now()}.png`;
      const outputPath = path.join(outputDir, filename);
      await poster.toFile(outputPath);

      return {
        outputPath,
        width: posterConfig.width,
        height: posterConfig.height,
        elements: posterConfig.elements.length,
      };
    } catch (error) {
      console.error("Error creating poster:", error);
      throw error;
    }
  }
);
