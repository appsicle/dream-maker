import OpenAI from 'openai';
import { z } from 'zod';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Define the response schema using Zod
const VariationSchema = z.object({
  variations: z.array(z.string()).length(5)
});

async function generateVariations(prompt, variators) {
  if (variators.length !== 5) {
    throw new Error('Exactly 5 variators are required');
  }

  const systemPrompt = `You are a creative prompt variation generator. Generate 5 unique variations of the given prompt, 
    each targeting one of the provided aspects. Respond ONLY with a JSON array containing exactly 5 strings.`;

  const userPrompt = `Base prompt: "${prompt}"
    Generate variations targeting these aspects: ${variators.join(', ')}
    Respond with ONLY a JSON array of 5 strings.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7
    });

    // Parse the response content as JSON
    const content = response.choices[0].message.content;
    const parsedContent = JSON.parse(content);

    // Validate the response using Zod schema
    const validatedData = VariationSchema.parse({ variations: parsedContent });
    return validatedData.variations;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.errors);
    } else {
      console.error('Error:', error.message);
    }
    throw error;
  }
}

// Example usage
const prompt = "Create a logo for a coffee shop";
const variators = [
  "Minimalist style",
  "Vintage theme",
  "Nature-inspired",
  "Modern geometric",
  "Hand-drawn aesthetic"
];

generateVariations(prompt, variators)
  .then(variations => {
    console.log('\nGenerated variations:');
    variations.forEach((variation, index) => {
      console.log(`${index + 1}. ${variation}`);
    });
  })
  .catch(error => console.error('Failed to generate variations:', error));
