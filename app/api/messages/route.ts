import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth/server';
import { fetchMessagesByPhone } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const phone = req.nextUrl.searchParams.get('phone');
  if (!phone || !phone.trim()) {
    return NextResponse.json({ error: 'Missing phone' }, { status: 400 });
  }

  const limitParam = req.nextUrl.searchParams.get('limit');
  const limit = Math.min(Number(limitParam || 120) || 120, 200);

  try {
    const messages = await fetchMessagesByPhone(phone.trim(), limit);
    return NextResponse.json({ messages });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch messages';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
