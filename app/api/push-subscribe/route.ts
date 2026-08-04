import { NextResponse } from 'next/server';
import { supabaseFromRequest } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const supabase = supabaseFromRequest(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const { subscription } = await req.json();
    if (!subscription?.endpoint) return NextResponse.json({ error: 'Subscription invalide' }, { status: 400 });

    await supabase.from('push_subscriptions').upsert(
      { user_id: user.id, subscription, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = supabaseFromRequest(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    await supabase.from('push_subscriptions').delete().eq('user_id', user.id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
