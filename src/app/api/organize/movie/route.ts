import { NextResponse } from 'next/server';
import { CmccClient } from '@/lib/cmcc/client';
import { TMDBClient } from '@/lib/tmdb/client';
import { extractMovieInfo, extractQualityTags, VIDEO_EXTS, cleanMovieNoise } from '@/lib/parsers';

export interface ActionLog {
    type: 'rename' | 'move' | 'mkdir' | 'clean';
    description: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { authorization, cookie, folderId, folderName, tmdbKey, dryRun, headers } = body;

    const client = new CmccClient({ authorization, cookie, headers });
    const tmdb = tmdbKey ? new TMDBClient(tmdbKey) : null;
    const logs: ActionLog[] = [];

    logs.push({ type: 'rename', description: `Processing Movie Folder: ${folderName}` });

    // 1. Resolve Movie Info
    const { title, year } = extractMovieInfo(folderName);
    let meta = { title, year, tmdbId: 0 };
    
    if (tmdb && title) {
         try {
             // Mock simple search or implement proper confidence check
             const results = await tmdb.searchMovie(title, year || undefined);
             if (results.length > 0) {
                 const best = results[0];
                 meta.title = best.title;
                 if (best.release_date) meta.year = parseInt(best.release_date.substring(0, 4));
                 meta.tmdbId = best.id;
             }
         } catch(e) {}
    }

    // 2. Rename Folder
    const newFolderName = meta.tmdbId 
        ? `${meta.title} (${meta.year}) [TMDB-${meta.tmdbId}]` 
        : (meta.year ? `${meta.title} (${meta.year})` : meta.title);

    if (newFolderName !== folderName) {
        if (dryRun) logs.push({ type: 'rename', description: `[DRY] Rename Folder: ${folderName} -> ${newFolderName}` });
        else {
             await client.rename(folderId, newFolderName);
             logs.push({ type: 'rename', description: `Renamed Folder: ${newFolderName}` });
        }
    }

    // 3. Rename File
    const entries = await client.listDir(folderId);
    const videoFile = entries.find(e => !e.is_dir && VIDEO_EXTS.has(e.name.substring(e.name.lastIndexOf('.')).toLowerCase()));

    if (videoFile) {
        const ext = videoFile.name.substring(videoFile.name.lastIndexOf('.'));
        const tagStr = extractQualityTags(videoFile.name);
        
        const newFileName = tagStr 
            ? `${meta.title} (${meta.year}) - ${tagStr}${ext}` 
            : `${meta.title} (${meta.year})${ext}`;
            
        if (videoFile.name !== newFileName) {
            if (dryRun) logs.push({ type: 'rename', description: `[DRY] Rename File: ${videoFile.name} -> ${newFileName}` });
            else {
                await client.rename(videoFile.file_id, newFileName);
                logs.push({ type: 'rename', description: `Renamed File: ${newFileName}` });
            }
        }
    }

    logs.push({ type: 'rename', description: `✓ 处理完成！共 ${logs.length} 条日志` });

    return NextResponse.json({ success: true, logs });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
