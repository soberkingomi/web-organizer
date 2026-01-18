import { NextResponse } from 'next/server';
import { CmccClient, DirEntry } from '@/lib/cmcc/client';
import { TMDBClient } from '@/lib/tmdb/client';
import { extractMovieInfo, extractQualityTags, VIDEO_EXTS, MISC_DIR_NAMES, JUNK_MARKERS, cleanMovieNoise, normalizeSpaces } from '@/lib/parsers';

export interface ActionLog {
    type: 'rename' | 'move' | 'mkdir' | 'clean' | 'skip' | 'info';
    description: string;
}

// 电影元数据
interface MovieMeta {
    title: string;
    year: number | null;
    tmdbId: number;
}

// 电影解析器
class MovieResolver {
    private tmdb: TMDBClient | null;
    
    constructor(tmdb: TMDBClient | null) {
        this.tmdb = tmdb;
    }
    
    async verify(folderName: string): Promise<MovieMeta | null> {
        const { title, year } = extractMovieInfo(folderName);
        if (!title) return null;
        
        let meta: MovieMeta = { title, year, tmdbId: 0 };
        
        // 检查显式 ID
        const mId = folderName.match(/[\{\[]TMDB-(\d+)[\}\]]/i);
        if (mId) {
            meta.tmdbId = parseInt(mId[1]);
            if (this.tmdb) {
                try {
                    const details = await this.tmdb.movieDetails(meta.tmdbId);
                    if (details.title) {
                        meta.title = details.title;
                        if (details.release_date) meta.year = parseInt(details.release_date.substring(0, 4));
                    }
                } catch (e) {}
            }
            return meta;
        }
        
        // TMDB 搜索
        if (this.tmdb && title) {
            try {
                const results = await this.tmdb.searchMovie(title, year || undefined);
                if (results && results.length > 0) {
                    const best = results[0];
                    meta.title = best.title;
                    if (best.release_date) meta.year = parseInt(best.release_date.substring(0, 4));
                    meta.tmdbId = best.id;
                }
            } catch (e) {}
        }
        
        return meta;
    }
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
            logs.push({ type: 'clean', description: `${dryRun ? '[DRY] ' : ''}清理垃圾: ${e.name}` });
        } else {
            clean.push(e);
        }
    }
    
    if (toRemove.length > 0 && !dryRun) {
        await client.remove(toRemove);
    }
    
    return clean;
}

// 检测是否为合集文件夹
const COLLECTION_REGEX = /(\d+部|合集|系列|Collection|Trilogy|Saga)/i;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { authorization, cookie, folderId, folderName, tmdbKey, dryRun, headers } = body;

    const client = new CmccClient({ authorization, cookie, headers });
    const tmdb = tmdbKey ? new TMDBClient(tmdbKey) : null;
    const logs: ActionLog[] = [];
    const resolver = new MovieResolver(tmdb);

    logs.push({ type: 'info', description: `处理电影: ${folderName}` });

    // 检测合集
    if (COLLECTION_REGEX.test(folderName)) {
        logs.push({ type: 'info', description: `检测到合集: ${folderName}` });
        
        // 重命名合集文件夹（只保留电影名）
        const { title: colTitle } = extractMovieInfo(folderName);
        if (colTitle && colTitle !== folderName) {
            if (dryRun) {
                logs.push({ type: 'rename', description: `[DRY] 重命名合集: ${folderName} -> ${colTitle}` });
            } else {
                await client.rename(folderId, colTitle);
                logs.push({ type: 'rename', description: `重命名合集: ${colTitle}` });
            }
        }
        
        let entries = await client.listDir(folderId);
        entries = await removeJunkFiles(client, entries, dryRun, logs);
        
        for (const e of entries) {
            // 视频文件 -> 创建独立电影文件夹
            if (!e.is_dir) {
                const ext = e.name.substring(e.name.lastIndexOf('.')).toLowerCase();
                if (!VIDEO_EXTS.has(ext)) continue;
                
                const meta = await resolver.verify(e.name);
                if (!meta) {
                    logs.push({ type: 'skip', description: `跳过未识别: ${e.name}` });
                    continue;
                }
                
                const targetFolderName = meta.title;
                const tagStr = extractQualityTags(e.name);
                const fileNm = `${meta.title} (${meta.year})`;
                const targetFileName = tagStr ? `${fileNm} - ${tagStr}${ext}` : `${fileNm}${ext}`;
                
                if (dryRun) {
                    logs.push({ type: 'mkdir', description: `[DRY] 创建: ${targetFolderName}` });
                    logs.push({ type: 'move', description: `[DRY] 移动并重命名: ${e.name} -> ${targetFileName}` });
                } else {
                    const newParent = await client.mkdir(folderId, targetFolderName);
                    await client.move([e.file_id], newParent);
                    await client.rename(e.file_id, targetFileName);
                    logs.push({ type: 'info', description: `处理完成: ${targetFolderName}/${targetFileName}` });
                }
            }
            // 子文件夹 -> 递归
            else if (e.is_dir) {
                // 递归处理（简化：这里不做完整递归，只做一层）
                logs.push({ type: 'info', description: `子文件夹: ${e.name} (需单独处理)` });
            }
        }
        
        logs.push({ type: 'info', description: `✓ 合集处理完成！` });
        return NextResponse.json({ success: true, logs });
    }

    // 单部电影逻辑
    const meta = await resolver.verify(folderName);
    if (!meta) {
        logs.push({ type: 'skip', description: `跳过未识别电影: ${folderName}` });
        return NextResponse.json({ success: true, logs });
    }

    // 1. 目标文件夹名
    let newFolderName: string;
    if (meta.tmdbId > 0) {
        newFolderName = `${meta.title} (${meta.year}) [TMDB-${meta.tmdbId}]`;
    } else {
        newFolderName = meta.year ? `${meta.title} (${meta.year})` : meta.title;
    }
    
    if (folderName !== newFolderName) {
        if (dryRun) {
            logs.push({ type: 'rename', description: `[DRY] 重命名文件夹: ${folderName} -> ${newFolderName}` });
        } else {
            await client.rename(folderId, newFolderName);
            logs.push({ type: 'rename', description: `重命名文件夹: ${newFolderName}` });
        }
    }

    // 2. 处理内部文件
    let entries = await client.listDir(folderId);
    entries = await removeJunkFiles(client, entries, dryRun, logs);
    
    // 收集视频文件
    const videoFiles = entries.filter(e => !e.is_dir && VIDEO_EXTS.has(e.name.substring(e.name.lastIndexOf('.')).toLowerCase()));
    
    for (const vf of videoFiles) {
        const tagStr = extractQualityTags(vf.name);
        const ext = vf.name.substring(vf.name.lastIndexOf('.'));
        
        const newFname = tagStr 
            ? `${meta.title} (${meta.year}) - ${tagStr}${ext}`
            : `${meta.title} (${meta.year})${ext}`;
            
        if (vf.name !== newFname) {
            if (dryRun) {
                logs.push({ type: 'rename', description: `[DRY] 重命名: ${vf.name} -> ${newFname}` });
            } else {
                await client.rename(vf.file_id, newFname);
                logs.push({ type: 'rename', description: `重命名: ${newFname}` });
            }
        }
    }

    logs.push({ type: 'info', description: `✓ 处理完成！共 ${logs.length} 条日志` });
    return NextResponse.json({ success: true, logs });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
