import { NextResponse } from 'next/server';
import { CmccClient } from '@/lib/cmcc/client';

const JUNK_MARKERS = ["www.", ".com", ".net", ".org", "dygm", "dygod", "ygdy8", "piaohua", "迅雷", "下载", "资源", "首发", ".pdf", ".txt", "免费", "搜索"];
const MISC_DIR_NAMES = new Set(["@eadir", "__macosx", ".ds_store", "sample", "samples", "screens", "screen", "screenshots", "extras", "extra", "bonus", "bts", "poster", "posters", "fanart", "thumb", "thumbs", "artwork", "cd1", "cd2", "subs", "sub", "subtitle", "subtitles", "字幕", "字幕组"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { authorization, cookie, folderId, dryRun, headers } = body;
    
    const client = new CmccClient({ authorization, cookie, headers });
    const logs: string[] = [];

    // Helper for recursion
    async function clean(fid: string) {
        const entries = await client.listDir(fid);
        const toRemove: string[] = [];
        
        for (const e of entries) {
            let isJunk = false;
            // Dir check
            if (e.is_dir) {
                if (MISC_DIR_NAMES.has(e.name.toLowerCase())) isJunk = true;
                else {
                    // Recurse
                   try { await clean(e.file_id); } catch(e) {}
                }
            } else {
                // File Check
                if (JUNK_MARKERS.some(m => e.name.includes(m))) isJunk = true;
            }

            if (isJunk) {
                toRemove.push(e.file_id);
                logs.push(`Found junk: ${e.name}`);
            }
        }

        if (toRemove.length > 0) {
            if (dryRun) logs.push(`[DRY] Removing ${toRemove.length} items from ${fid}`);
            else await client.remove(toRemove);
        }
    }

    await clean(folderId);
    
    logs.push(`✓ 清理完成！共发现 ${logs.length} 个垃圾项`);
    
    return NextResponse.json({ success: true, logs });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
