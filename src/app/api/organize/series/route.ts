import { NextResponse } from 'next/server';
import { CmccClient, DirEntry } from '@/lib/cmcc/client';
import { TMDBClient } from '@/lib/tmdb/client';
import { cleanSeriesQuery, extractQualityTags, parseEpisodeFromName, parseSeasonFromText, VIDEO_EXTS, SUB_EXTS, MISC_DIR_NAMES, JUNK_MARKERS } from '@/lib/parsers';

export interface ActionLog {
    type: 'rename' | 'move' | 'mkdir' | 'clean' | 'skip' | 'info';
    description: string;
}

// 剧集元数据
interface SeriesMeta {
    name: string;
    year: number | null;
    tvId: number;
}

// 识别剧集信息
async function resolveSeries(
    tmdb: TMDBClient | null,
    folderName: string
): Promise<SeriesMeta | null> {
    let meta: SeriesMeta = { name: folderName, year: null, tvId: 0 };
    
    // 显式 ID 检查 {tmdb-xxx}
    const mId = folderName.match(/[\{\[]tmdb-(\d+)[\}\]]/i);
    if (mId) {
        meta.tvId = parseInt(mId[1]);
        meta.name = cleanSeriesQuery(folderName.replace(mId[0], ""));
        if (tmdb) {
            try {
                const details = await tmdb.tvDetails(meta.tvId);
                if (details.name) {
                    meta.name = details.name;
                    if (details.first_air_date) meta.year = parseInt(details.first_air_date.substring(0, 4));
                }
            } catch (e) {}
        }
    } else if (tmdb) {
        const key = cleanSeriesQuery(folderName);
        const results = await tmdb.searchTv(key);
        if (results && results.length > 0) {
            const best = results[0];
            meta.tvId = best.id;
            meta.name = best.name;
            if (best.first_air_date) meta.year = parseInt(best.first_air_date.substring(0, 4));
        }
    }
    
    return meta;
}

// 清理垃圾文件
async function removeJunkFiles(
    client: CmccClient,
    entries: DirEntry[],
    dryRun: boolean,
    logs: ActionLog[]
): Promise<DirEntry[]> {
    const toRemove: string[] = [];
    const clean: DirEntry[] = [];
    
    for (const e of entries) {
        let isJunk = false;
        if (e.is_dir) {
            if (MISC_DIR_NAMES.has(e.name.toLowerCase())) isJunk = true;
        } else {
            if (JUNK_MARKERS.some(m => e.name.toLowerCase().includes(m.toLowerCase()))) isJunk = true;
        }
        
        if (isJunk) {
            toRemove.push(e.file_id);
            logs.push({ type: 'clean', description: `${dryRun ? '[DRY] ' : ''}Remove junk: ${e.name}` });
        } else {
            clean.push(e);
        }
    }
    
    if (toRemove.length > 0 && !dryRun) {
        await client.remove(toRemove);
    }
    
    return clean;
}

// 处理单个剧集文件夹
async function processSeriesFolder(
    client: CmccClient, 
    tmdb: TMDBClient | null, 
    folderId: string, 
    folderName: string, 
    dryRun: boolean,
    logs: ActionLog[]
) {
    logs.push({ type: 'info', description: `处理剧集: ${folderName}` });

    // 1. 识别剧集
    const meta = await resolveSeries(tmdb, folderName);
    if (!meta) {
        logs.push({ type: 'skip', description: `跳过未识别剧集: ${folderName}` });
        return;
    }

    const folderNewName = (meta.year && meta.tvId) 
        ? `${meta.name} (${meta.year}) [TMDB-${meta.tvId}]` 
        : meta.name;
    const seriesFilePrefix = meta.name;
    
    logs.push({ type: 'info', description: `识别为: ${folderNewName}` });

    // 2. 重命名剧集主文件夹
    if (meta.name && folderName !== folderNewName) {
        if (dryRun) {
            logs.push({ type: 'rename', description: `[DRY] 重命名文件夹: ${folderName} -> ${folderNewName}` });
        } else {
            await client.rename(folderId, folderNewName);
            logs.push({ type: 'rename', description: `重命名文件夹: ${folderNewName}` });
        }
    }

    // 3. 列出目录内容
    let entries = await client.listDir(folderId);
    
    // 清理垃圾文件
    entries = await removeJunkFiles(client, entries, dryRun, logs);
    
    // 映射季信息: season_num -> file_id
    const seasonMap = new Map<number, string>();
    const filesToProcess: DirEntry[] = [];

    for (const e of entries) {
        if (e.is_dir) {
            const s = parseSeasonFromText(e.name);
            if (s !== null) {
                seasonMap.set(s, e.file_id);
                // 规范化季文件夹名为 Sxx
                const stdName = `S${s.toString().padStart(2, '0')}`;
                if (e.name !== stdName) {
                    if (dryRun) {
                        logs.push({ type: 'rename', description: `[DRY] 重命名季: ${e.name} -> ${stdName}` });
                    } else {
                        await client.rename(e.file_id, stdName);
                        logs.push({ type: 'rename', description: `重命名季: ${stdName}` });
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

    // 4. 处理根目录下的视频/字幕文件 (移动到季目录 & 重命名)
    for (const f of filesToProcess) {
        let { season, episode } = parseEpisodeFromName(f.name);
        if (season === null) season = 1; // 默认为第 1 季
        if (episode === null) continue; // 无法识别集号则跳过

        // 确保季目录存在
        let sid = seasonMap.get(season);
        const sName = `S${season.toString().padStart(2, '0')}`;
        
        if (!sid) {
            if (dryRun) {
                logs.push({ type: 'mkdir', description: `[DRY] 创建目录 ${sName}` });
                sid = "dry_run_id";
            } else {
                sid = await client.mkdir(folderId, sName);
                logs.push({ type: 'mkdir', description: `创建目录 ${sName}` });
            }
            seasonMap.set(season, sid);
        }

        // 移动文件
        if (f.parent_file_id !== sid && sid !== "dry_run_id") {
            if (dryRun) {
                logs.push({ type: 'move', description: `[DRY] 移动 ${f.name} -> ${sName}/` });
            } else {
                await client.move([f.file_id], sid);
                logs.push({ type: 'move', description: `移动 ${f.name} -> ${sName}/` });
            }
        }
        
        // 重命名文件
        const ext = f.name.substring(f.name.lastIndexOf('.'));
        const tagStr = extractQualityTags(f.name);
        const newName = tagStr 
            ? `${seriesFilePrefix} - S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')} - ${tagStr}${ext}`
            : `${seriesFilePrefix} - S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}${ext}`;

        if (f.name !== newName) {
            if (dryRun) {
                logs.push({ type: 'rename', description: `[DRY] 重命名: ${f.name} -> ${newName}` });
            } else {
                await client.rename(f.file_id, newName);
                logs.push({ type: 'rename', description: `重命名: ${newName}` });
            }
        }
    }

    // 5. 递归处理已存在的季文件夹内容
    for (const [s, sid] of seasonMap.entries()) {
        if (dryRun && sid === "dry_run_id") continue;
        
        const seasonFiles = await client.listDir(sid);
        for (const f of seasonFiles) {
            if (f.is_dir) continue;
            
            const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
            if (!VIDEO_EXTS.has(ext) && !SUB_EXTS.has(ext)) continue;
            
            // 只从文件名提取集数，季号以文件夹为准
            const { episode: ep } = parseEpisodeFromName(f.name);
            if (ep === null) continue;
            
            // 季号直接使用文件夹的季号 s，忽略文件名中的季信息
            const fileExt = f.name.substring(f.name.lastIndexOf('.'));
            const tagStr = extractQualityTags(f.name);
            const newName = tagStr 
                ? `${seriesFilePrefix} - S${s.toString().padStart(2, '0')}E${ep.toString().padStart(2, '0')} - ${tagStr}${fileExt}`
                : `${seriesFilePrefix} - S${s.toString().padStart(2, '0')}E${ep.toString().padStart(2, '0')}${fileExt}`;
            
            if (f.name !== newName) {
                if (dryRun) {
                    logs.push({ type: 'rename', description: `[DRY] 重命名 (S${s.toString().padStart(2, '0')}内): ${f.name} -> ${newName}` });
                } else {
                    await client.rename(f.file_id, newName);
                    logs.push({ type: 'rename', description: `重命名 (S${s.toString().padStart(2, '0')}内): ${newName}` });
                }
            }
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
    
    logs.push({ type: 'info', description: `✓ 处理完成！共 ${logs.length} 条日志` });

    return NextResponse.json({ success: true, logs });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
