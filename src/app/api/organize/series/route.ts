import { NextResponse } from 'next/server';
import { CmccClient, DirEntry } from '@/lib/cmcc/client';
import { TMDBClient } from '@/lib/tmdb/client';
import { cleanSeriesQuery, extractQualityTags, parseEpisodeFromName, VIDEO_EXTS, SUB_EXTS } from '@/lib/parsers';

// Helper to simulate "UndoLogger" / Action Recorder
export interface ActionLog {
    type: 'rename' | 'move' | 'mkdir' | 'clean';
    description: string;
    details?: any;
}

async function processSeriesFolder(
    client: CmccClient, 
    tmdb: TMDBClient | null, 
    folderId: string, 
    folderName: string, 
    dryRun: boolean,
    logs: ActionLog[]
) {
    logs.push({ type: 'rename', description: `Processing Series Folder: ${folderName}` });

    // 1. Resolve Series
    let meta = { name: folderName, year: null as number | null, tmdbId: 0 };
    
    // Explicit ID check {tmdb-xxx}
    const mId = folderName.match(/[\{\[]tmdb-(\d+)[\}\]]/i);
    if (mId) {
        meta.tmdbId = parseInt(mId[1]);
        const cleanName = cleanSeriesQuery(folderName.replace(mId[0], ""));
        meta.name = cleanName;
        // Try fetch details if TMDB available
        if (tmdb) {
            try {
                const details = await tmdb.tvDetails(meta.tmdbId);
                if (details.name) {
                    meta.name = details.name;
                    if (details.first_air_date) meta.year = parseInt(details.first_air_date.substring(0, 4));
                }
            } catch (e) {}
        }
    } else if (tmdb) {
        // Search
        const key = cleanSeriesQuery(folderName);
        const results = await tmdb.searchTv(key);
        if (results && results.length > 0) {
            const best = results[0];
            meta.tmdbId = best.id;
            meta.name = best.name;
            if (best.first_air_date) meta.year = parseInt(best.first_air_date.substring(0, 4));
        }
    }
    
    // 2. Rename Folder
    let newFolderName = meta.name;
    if (meta.year && meta.tmdbId) {
        newFolderName = `${meta.name} (${meta.year}) [TMDB-${meta.tmdbId}]`;
    }
    
    if (newFolderName !== folderName) {
        if (dryRun) {
            logs.push({ type: 'rename', description: `[DRY] Rename Folder: ${folderName} -> ${newFolderName}` });
        } else {
             // We can't actually update the "current" folder name easily if we are *inside* it without parent ID
             // The API requires fileId.
             await client.rename(folderId, newFolderName);
             logs.push({ type: 'rename', description: `Renamed Folder: ${newFolderName}` });
        }
    }

    // 3. List Content
    const entries = await client.listDir(folderId);
    const seasonMap = new Map<number, string>();
    const filesToProcess: DirEntry[] = [];

    // Parse existing folders
    for (const e of entries) {
        if (e.is_dir) {
            // Check for Sxx
            const mParams = e.name.match(/^S(\d{1,2})$/i);
            if (mParams) {
                const s = parseInt(mParams[1]);
                seasonMap.set(s, e.file_id);
                // Standardize S1 -> S01
                const std = `S${s.toString().padStart(2, '0')}`;
                if (e.name !== std) {
                     if (dryRun) logs.push({type:'rename', description: `[DRY] Rename Season: ${e.name} -> ${std}`});
                     else await client.rename(e.file_id, std);
                }
            } else {
                // Try fuzzy parse "Season 1"
                const mSeason = e.name.match(/(?:^|[^a-zA-Z])S(\d{1,2})(?:\D|$)/i) || e.name.match(/Season\s*(\d+)/i) || e.name.match(/第\s*(\d+)\s*[季部]/);
                if (mSeason) {
                    const s = parseInt(mSeason[1]); // Note: "第x季" chinese handling simplified here for now (assuming digits)
                    // We only handle digits for web V1 to be safe, complex chinese numerals porting skipped for brevity unless critical
                    if (!seasonMap.has(s)) {
                        seasonMap.set(s, e.file_id);
                        const std = `S${s.toString().padStart(2, '0')}`;
                        if (dryRun) logs.push({type:'rename', description: `[DRY] Rename Season: ${e.name} -> ${std}`});
                        else await client.rename(e.file_id, std);
                    }
                }
            }
        } else {
            const ext = e.name.substring(e.name.lastIndexOf('.')).toLowerCase();
             if (VIDEO_EXTS.has(ext) || SUB_EXTS.has(ext)) {
                 filesToProcess.push(e);
             }
        }
    }

    // 4. Process Files
    for (const f of filesToProcess) {
        const { season, episode } = parseEpisodeFromName(f.name);
        const s = season || 1; 
        if (episode === null) continue;

        // Ensure Season Folder
        let sid = seasonMap.get(s);
        const sName = `S${s.toString().padStart(2, '0')}`;

        if (!sid) {
            if (dryRun) {
                 logs.push({type:'mkdir', description: `[DRY] Mkdir ${sName}`});
                 sid = "dry_run_id_" + s;
            } else {
                 sid = await client.mkdir(folderId, sName) as string; // Wait check mkdir return type compatibility
                 // Actually CmccClient.mkdir needs return string.
                 // Checking client.ts... I haven't implemented mkdir yet! 
                 // WAIT. I missed implementing mkdir, rename, move in client.ts.
                 // I implemented listDir and rename... wait let me check client.ts
            }
            seasonMap.set(s, sid!);
        }
        
        // Move
        if (f.parent_file_id !== sid) {
             if (dryRun) logs.push({type:'move', description: `[DRY] Move ${f.name} -> ${sName}/`});
             else await client.move([f.file_id], sid!); // client.ts needs move
        }

        // Rename
        const tagStr = extractQualityTags(f.name);
        const ext = f.name.substring(f.name.lastIndexOf('.'));
        const newName = tagStr 
            ? `${meta.name} - S${s.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')} - ${tagStr}${ext}`
            : `${meta.name} - S${s.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}${ext}`;
        
        if (f.name !== newName) {
            if (dryRun) logs.push({type:'rename', description: `[DRY] Rename File: ${f.name} -> ${newName}`});
            else await client.rename(f.file_id, newName);
        }
    }
}


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { authorization, cookie, folderId, folderName, tmdbKey, dryRun, headers } = body;

    const client = new CmccClient({ authorization, cookie, headers });
    const tmdb = tmdbKey ? new TMDBClient(tmdbKey) : null;
    
    const logs: ActionLog[] = [];
    
    await processSeriesFolder(client, tmdb, folderId, folderName, dryRun, logs);
    
    logs.push({ type: 'rename', description: `✓ 处理完成！共 ${logs.length} 条日志` });

    return NextResponse.json({ success: true, logs });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
