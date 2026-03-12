import { NextResponse } from 'next/server';

import { fetchRecentMessages, getConfigStatus, pingSupabase } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = getConfigStatus();
  const supabase = await pingSupabase();

  let recentCount = 0;
  let latestTimestamp: string | null = null;
  let messagesError: string | null = null;

  if (supabase.ok) {
    try {
      const messages = await fetchRecentMessages(5);
      recentCount = messages.length;
      latestTimestamp = messages[0]?.timestamp ?? null;
    } catch (error: any) {
      messagesError = error.message;
    }
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    config,
    supabase,
    ingestion: {
      recentCount,
      latestTimestamp,
      messagesError,
    },
  });
}
