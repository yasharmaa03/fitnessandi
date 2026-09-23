import { sendWhatsAppMessage, logWhatsAppMessage } from '@/lib/whatsapp/send';
import { routeIncomingMessage } from '@/lib/whatsapp/commands';
import { resolveUserIdFromPhone } from '@/lib/whatsapp/users';

// Meta calls this once when the webhook URL is configured, to verify ownership.
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return new Response('Forbidden', { status: 403 });
}

interface WhatsAppWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from?: string;
          text?: { body?: string };
          type?: string;
        }>;
      };
    }>;
  }>;
}

export async function POST(request: Request): Promise<Response> {
  let payload: WhatsAppWebhookPayload;
  try {
    payload = (await request.json()) as WhatsAppWebhookPayload;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  // Meta also sends delivery/read status callbacks with no `messages` field — ack and skip.
  if (!message?.from || message.type !== 'text' || !message.text?.body) {
    return new Response('OK', { status: 200 });
  }

  const from = message.from;
  const text = message.text.body;

  console.log('[WhatsApp Webhook] Received message:', { from, text });

  try {
    const userId = await resolveUserIdFromPhone(from);
    console.log('[WhatsApp Webhook] Resolved user ID:', userId);
    
    await logWhatsAppMessage({ user_id: userId, phone_number: from, direction: 'incoming', message_text: text });
    
    const reply = await routeIncomingMessage(text, userId);
    console.log('[WhatsApp Webhook] Generated reply:', reply);
    
    await sendWhatsAppMessage(from, reply, userId);
    console.log('[WhatsApp Webhook] Message sent successfully');
  } catch (err) {
    console.error('[WhatsApp Webhook] Failed to process incoming message:', err);
    await sendWhatsAppMessage(from, 'Sorry, something went wrong on our end. Please try again shortly.');
  }

  // WhatsApp requires a 200 response regardless of processing outcome, or it will retry delivery.
  return new Response('OK', { status: 200 });
}
