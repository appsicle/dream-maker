import express from "express";
import OpenAI from "openai";
import { z } from "zod";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Replicate from "replicate";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static("public"));

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

// Define the response schema using Zod
const PromptVariation = z.object({
  variation: z.string().min(1).describe("A creative variation of the original prompt"),
  reasoning: z.string().min(1).describe("Brief explanation of how this variation relates to the given aspect"),
});

const VariationsResponse = z.object({
  variations: z.array(PromptVariation).length(5),
});

async function upscaleImage(imageUrl) {
  try {
    console.log("⬆️ Starting image upscale for:", imageUrl);
    const output = await replicate.run("recraft-ai/recraft-crisp-upscale", {
      input: {
        image: imageUrl,
      },
    });
    console.log("✅ Upscale complete:", output);
    return output;
  } catch (error) {
    console.error("❌ Image upscaling error:", error);
    return null;
  }
}

async function generateImage(prompt) {
  try {
    console.log("🎨 Generating image for prompt:", prompt);
    const output = await replicate.run("minimax/image-01", {
      input: {
        prompt,
        aspect_ratio: "9:16",
        number_of_images: 1,
        prompt_optimizer: true,
      },
    });
    console.log("✅ Image generation complete:", output);

    if (!output[0]) {
      console.log("⚠️ No image generated in output");
      return null;
    }

    console.log("🔄 Starting upscale process for generated image");
    const upscaledUrl = await upscaleImage(output[0]);

    const result = {
      original: output[0],
      upscaled: upscaledUrl,
    };
    console.log("✅ Final image result:", result);
    return result;
  } catch (error) {
    console.error("❌ Image generation error:", error);
    return null;
  }
}

async function generateVariations(prompt, variators) {
  console.log("🚀 Starting variation generation for prompt:", prompt);
  console.log("📝 Using variators:", variators);

  if (variators.length !== 5) {
    console.error("❌ Invalid number of variators:", variators.length);
    throw new Error("Exactly 5 variators are required");
  }

  const systemPrompt = `You are a creative prompt variation generator. For each variator, create a unique variation of the base prompt that incorporates that aspect. Include a brief explanation of how the variation relates to the given aspect.

IMPORTANT: Your response must be a valid JSON object with this exact structure:
{
  "variations": [
    {
      "variation": "string containing the modified prompt",
      "reasoning": "string explaining how it relates to the aspect"
    }
  ]
}

You must generate exactly 5 variations, one for each aspect provided.`;

  const userPrompt = `Base prompt: "${prompt}"
Create variations targeting these aspects: ${variators.join(", ")}

Remember to respond with a valid JSON object containing exactly 5 variations.`;

  try {
    console.log("🤖 Sending request to OpenAI");
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });
    console.log("✅ OpenAI response received:", response.choices[0].message);

    let parsedContent;
    try {
      console.log("🔍 Parsing JSON response");
      parsedContent = JSON.parse(response.choices[0].message.content);
      console.log("✅ Parsed JSON:", parsedContent);
    } catch (parseError) {
      console.error("❌ JSON Parse Error:", parseError);
      console.error("📄 Raw content:", response.choices[0].message.content);
      throw new Error("Failed to parse OpenAI response as JSON");
    }

    try {
      console.log("🔍 Validating response structure with Zod");
      const validatedData = VariationsResponse.parse(parsedContent);
      console.log("✅ Validation successful:", validatedData);

      console.log("🎨 Starting parallel image generation");
      const imagePromises = validatedData.variations.map((variation) =>
        generateImage(variation.variation)
      );
      const images = await Promise.all(imagePromises);
      console.log("✅ All images generated:", images);

      console.log("🔄 Combining results");
      const results = validatedData.variations.map((variation, index) => ({
        text: variation.variation,
        reasoning: variation.reasoning,
        images: images[index] || { original: null, upscaled: null },
      }));
      console.log("✅ Final results prepared:", results);

      return results;
    } catch (zodError) {
      console.error("❌ Zod Validation Error:", zodError);
      console.error("📄 Invalid data structure:", parsedContent);
      throw new Error(`Invalid response structure: ${zodError.message}`);
    }
  } catch (error) {
    console.error("❌ OpenAI API Error:", error);
    throw error;
  }
}

app.post("/generate", async (req, res) => {
  console.log("📥 Received request:", req.body);
  try {
    const { prompt, variators } = req.body;
    if (!prompt || !variators || !Array.isArray(variators)) {
      console.error("❌ Invalid request format:", req.body);
      return res.status(400).json({ error: "Invalid input format" });
    }
    const results = await generateVariations(prompt, variators);
    console.log("✅ Sending successful response");
    res.json({ results });
  } catch (error) {
    console.error("❌ Request processing error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
