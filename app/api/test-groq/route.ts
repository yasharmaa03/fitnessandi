import { estimateMacrosFromDescription } from '@/lib/nutrition/describe-meal';

export async function GET() {
  try {
    console.log('[Test Groq] Starting test...');
    const result = await estimateMacrosFromDescription('2 idlis and sambar');
    console.log('[Test Groq] Success:', result);
    return Response.json({ success: true, result });
  } catch (error) {
    console.error('[Test Groq] Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    return Response.json({ 
      success: false, 
      error: errorMessage,
      stack: errorStack,
      envCheck: {
        hasGroqKey: !!process.env.GROQ_API_KEY,
        keyPrefix: process.env.GROQ_API_KEY?.substring(0, 10)
      }
    }, { status: 500 });
  }
}
