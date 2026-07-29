// This route is no longer used — SofaScore is called directly from the client
// to avoid server-side 403 blocks on cloud IPs.
import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({ deprecated: true }, { status: 410 });
}
