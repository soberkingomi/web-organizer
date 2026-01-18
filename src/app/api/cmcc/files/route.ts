import { NextResponse } from 'next/server';
import { CmccClient } from '@/lib/cmcc/client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { authorization, cookie, fileId, headers } = body;

    if (!authorization || !cookie) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
    }

    const client = new CmccClient({ authorization, cookie, headers });
    const id = fileId || "root";
    
    const items = await client.listDir(id);
    return NextResponse.json({ items });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
