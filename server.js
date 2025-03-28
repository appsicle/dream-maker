import express from "express";
import OpenAI from "openai";
import { z } from "zod";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import Replicate from "replicate";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  variation: z
    .string()
    .min(1)
    .describe("A creative variation of the original prompt"),
  reasoning: z
    .string()
    .min(1)
    .describe(
      "Brief explanation of how this variation relates to the given aspect"
    ),
});

const VariationsResponse = z.object({
  variations: z.array(PromptVariation).length(5),
});

const DetailedPromptResponse = z.object({
  basePrompt: z.string().min(1).describe("The detailed prompt"),
  aspects: z.array(z.string().min(1)).length(5),
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

async function convertImageToVideo(imageUrl) {
  console.log("🎬 Converting image to video using kling 1.6:", imageUrl);

  try {
    const input = {
      prompt: "subject walking forward fashion runway model style, facing camera, epic, cinematic", // Fashion runway prompt
      start_image: imageUrl,
      aspect_ratio: "9:16",
      fps: 6
    };

    const output = await replicate.run("kwaivgi/kling-v1.6-standard", {
      input,
    });

    console.log("✅ Video generation complete:", output);
    return output;
  } catch (error) {
    console.error("❌ Video generation error:", error);
    throw error;
  }
}

async function generateDetailedPrompt(briefDescription) {
  console.log(
    "🎯 Expanding brief description into detailed prompt:",
    briefDescription
  );

  const systemPrompt = `You are a creative prompt variation generator specializing in cinematic scenes with a SINGLE HUMAN SUBJECT walking forward on a fashion runway. For each aspect, create a dramatically different variation that takes the base prompt to its absolute limit while ALWAYS maintaining a single human subject, centered in the frame, FACING THE CAMERA, and walking forward like on a fashion runway.  

For example:
- Don't change the subject to anything non-human - always keep a single human as the central figure
- Don't change the walking motion - the human must always be walking forward FACING THE CAMERA like on a fashion runway
- Don't add multiple subjects - focus on a single human character
- ALWAYS maintain the fashion runway style walk with the subject facing the camera
- DO vary the lighting, environment, time period, weather, clothing, and artistic style dramatically
- DO vary the appearance of the human (clothing, age, style) while keeping them human, centered, and facing the camera

IMPORTANT: Your response must be a valid JSON object with this exact structure:
{
  "basePrompt": "the detailed prompt you've created, must include a single human subject, centered, facing the camera, and walking forward like on a fashion runway, epic, cinematic",
  "aspects": [
    "wildly different setting/environment while maintaining the centered human walking forward on a runway, facing camera",
    "dramatically different lighting/atmosphere with the same fashion runway walking style, facing camera",
    "completely transformed time period/era with the human subject walking a runway, facing camera",
    "radically different clothing/appearance for the human subject while maintaining the runway walk, facing camera",
    "extreme artistic style variation while keeping the human subject centered on a runway, facing camera"
  ]
}`;

  const userPrompt = `Create a detailed, epic, cinematic prompt based on this brief description: "${briefDescription}". 

The prompt MUST feature a SINGLE HUMAN SUBJECT, CENTERED in the frame, FACING THE CAMERA, and WALKING FORWARD like on a FASHION SHOW RUNWAY as the central action. The human must remain human (not transformed into anything non-human) and must be walking directly toward the camera as if on a fashion runway.

Then, generate exactly 5 different aspects that could be varied to create dramatically different versions. Each aspect should focus on varying the SETTING or APPEARANCE of the human character, while maintaining the core elements (single human subject, centered, facing camera, runway-style walking).

Remember to respond with a valid JSON object containing the basePrompt and 5 aspects.`;

  try {
    console.log("🤖 Sending request to OpenAI");
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });
    console.log("✅ OpenAI response received");

    try {
      console.log("🔍 Parsing JSON response");
      const parsedContent = JSON.parse(response.choices[0].message.content);
      console.log("✅ Parsed JSON:", parsedContent);

      // Validate the response structure
      console.log("🔍 Validating response structure");
      const validatedData = DetailedPromptResponse.parse(parsedContent);
      console.log("✅ Validation successful:", validatedData);

      // Ensure the base prompt includes a single human subject walking forward on a runway, facing camera
      if (!validatedData.basePrompt.toLowerCase().includes("human") || 
          !validatedData.basePrompt.toLowerCase().includes("walking") ||
          !validatedData.basePrompt.toLowerCase().includes("facing") ||
          !validatedData.basePrompt.toLowerCase().includes("runway")) {
        validatedData.basePrompt +=
          ", single human subject, centered, facing the camera, and walking forward like on a fashion runway, epic, cinematic";
      }

      return validatedData;
    } catch (error) {
      console.error("❌ JSON Parse or Validation Error:", error);
      throw error;
    }
  } catch (error) {
    console.error("❌ Prompt generation error:", error);
    throw error;
  }
}

async function generateVariations(prompt, variators, generateVideos = false) {
  console.log("🚀 Starting variation generation for prompt:", prompt);
  console.log("📝 Using variators:", variators);
  console.log("🎬 Generate videos:", generateVideos);

  if (variators.length !== 5) {
    console.error("❌ Invalid number of variators:", variators.length);
    throw new Error("Exactly 5 variators are required");
  }

  const systemPrompt = `You are a creative prompt variation generator that specializes in creating epic, cinematic scenes with a SINGLE HUMAN SUBJECT walking forward on a fashion runway. For each variator, create a wild and unexpected variation that transforms the original prompt while ALWAYS maintaining a single human subject, centered in the frame, FACING THE CAMERA, and walking forward like on a fashion show runway.

IMPORTANT: Your response must be a valid JSON object with this exact structure:
{
  "variations": [
    {
      "variation": "string containing the modified prompt, must include a single human subject, centered, facing the camera, and walking forward like on a fashion runway, epic, cinematic",
      "reasoning": "string explaining the transformation"
    }
  ]
}

Guidelines for variations (while keeping the single human subject walking forward on a runway):
- ALWAYS keep a single human as the central figure - never transform them into anything non-human
- ALWAYS keep the human centered in the frame and FACING THE CAMERA
- ALWAYS maintain the forward walking motion like on a fashion runway
- ALWAYS ensure the subject is walking directly toward the camera
- DO vary the environment and setting dramatically
- DO vary the lighting, weather, and atmosphere
- DO vary the clothing and appearance of the human (while keeping them human)
- DO vary the artistic style and visual treatment
- NEVER add multiple subjects or change the core runway walking action

You must generate exactly 5 variations, each one with a different setting or appearance, but ALL must feature a single human subject, centered, facing the camera, and walking forward like on a fashion runway!`;

  const userPrompt = `Base prompt: "${prompt}"
Create EXTREMELY DIFFERENT variations targeting these aspects: ${variators.join(
    ", "
  )}

Push each variation to its absolute limit - be creative, be wild, be ridiculous!
Remember to respond with a valid JSON object containing exactly 5 mind-bending variations.`;

  try {
    console.log("🤖 Sending request to OpenAI");
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 1.0, // Increased for more creative variations
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

      // Ensure all variations include a single human subject walking forward on a runway, facing camera
      validatedData.variations.forEach((variation) => {
        if (!variation.variation.toLowerCase().includes("human") || 
            !variation.variation.toLowerCase().includes("walking") ||
            !variation.variation.toLowerCase().includes("facing") ||
            !variation.variation.toLowerCase().includes("runway")) {
          variation.variation += ", single human subject, centered, facing the camera, and walking forward like on a fashion runway, epic, cinematic";
        }
      });

      console.log("🎨 Starting parallel image generation");
      const imagePromises = validatedData.variations.map((variation) =>
        generateImage(variation.variation)
      );
      const images = await Promise.all(imagePromises);
      console.log("✅ All images generated:", images);

      // Generate videos if requested
      let videos = [];
      if (generateVideos) {
        console.log("🎬 Starting parallel video generation");
        const videoPromises = images.map((image) =>
          image.upscaled ? convertImageToVideo(image.upscaled) : null
        );
        videos = await Promise.all(videoPromises);
        console.log("✅ All videos generated:", videos);
      }

      console.log("🔄 Combining results");
      const results = validatedData.variations.map((variation, index) => ({
        text: variation.variation,
        reasoning: variation.reasoning,
        images: images[index] || { original: null, upscaled: null },
        video: generateVideos ? videos[index] : null,
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
    const { prompt, generateVideos } = req.body;
    if (!prompt) {
      console.error("❌ Invalid request format:", req.body);
      return res.status(400).json({ error: "Invalid input format" });
    }

    // First, generate the detailed prompt and aspects
    const detailedPrompt = await generateDetailedPrompt(prompt);

    // Then generate variations using the detailed prompt
    const results = await generateVariations(
      detailedPrompt.basePrompt,
      detailedPrompt.aspects,
      generateVideos
    );

    console.log("✅ Sending successful response");
    res.json({
      results,
      basePrompt: detailedPrompt.basePrompt,
      aspects: detailedPrompt.aspects,
    });
  } catch (error) {
    console.error("❌ Request processing error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
