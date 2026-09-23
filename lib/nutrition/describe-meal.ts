import type { DescriptionAnalysisResult } from '@/lib/types/claude';

function stripJsonFences(content: string): string {
  return content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function isValidDescriptionResult(data: unknown): data is DescriptionAnalysisResult {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.meal_name === 'string' &&
    typeof d.calories === 'number' && d.calories >= 0 &&
    typeof d.protein_g === 'number' && d.protein_g >= 0 &&
    typeof d.carbs_g === 'number' && d.carbs_g >= 0 &&
    typeof d.fat_g === 'number' && d.fat_g >= 0 &&
    typeof d.fiber_g === 'number' && d.fiber_g >= 0 &&
    Array.isArray(d.items) &&
    typeof d.confidence === 'number' &&
    typeof d.assumptions === 'string'
  );
}

// Shared by app/api/nutrition/analyze-description and the WhatsApp food-logging flow.
export async function estimateMacrosFromDescription(
  description: string
): Promise<DescriptionAnalysisResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY not configured');
  }

  const prompt = `Analyze this meal description and return nutritional information as JSON only — no markdown, no explanation, no code fences.

Meal description: "${description}"

Return exactly this JSON structure:
{
  "meal_name": "Short descriptive meal name",
  "calories": <number>,
  "protein_g": <number>,
  "carbs_g": <number>,
  "fat_g": <number>,
  "fiber_g": <number>,
  "items": ["item1", "item2"],
  "confidence": <number 0-100>,
  "assumptions": "Brief note on any portion size assumptions made"
}

Use standard nutritional values. If quantities are unclear, assume typical serving sizes for the region/cuisine implied by the description. All numeric values must be non-negative integers.`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'mixtral-8x7b-32768',
      temperature: 0.3,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Groq API] Error response:', response.status, errorText);
    throw new Error(`Description analysis failed: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const rawContent = data.choices?.[0]?.message?.content ?? '';
  const sanitized = stripJsonFences(rawContent);

  let parsed: unknown;
  try {
    parsed = JSON.parse(sanitized);
  } catch (parseError) {
    console.error('[Groq API] Failed to parse JSON:', sanitized);
    throw new Error('Description analysis failed - invalid JSON response');
  }

  if (!isValidDescriptionResult(parsed)) {
    console.error('[Groq API] Invalid result structure:', parsed);
    throw new Error('Description analysis failed - invalid response structure');
  }

  return parsed;
}
