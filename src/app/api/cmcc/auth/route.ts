import { NextResponse } from 'next/server';
import { CmccClient } from '@/lib/cmcc/client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { authorization, cookie, rootId, headers } = body;

    if (!authorization || !cookie) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
    }

    const client = new CmccClient({ authorization, cookie, headers });
    
    // Try to list root or a known ID to verify login
    try {
        const verifyId = rootId || "root";
        const items = await client.listDir(verifyId);
        return NextResponse.json({ success: true, items: items.slice(0, 5) }); // Return first 5 to confirm
    } catch (e: any) {
        return NextResponse.json({ error: 'Login failed: ' + e.message }, { status: 401 });
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
