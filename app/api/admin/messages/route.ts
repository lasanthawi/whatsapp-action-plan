import { NextRequest, NextResponse } from 'next/server';

import { fetchRecentMessages } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const limitParam = req.nextUrl.searchParams.get('limit');
  const limit = Math.min(Number(limitParam || 20) || 20, 100);

  try {
    const messages = await fetchRecentMessages(limit);
    return NextResponse.json({ messages });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
