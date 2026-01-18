import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // 方式1: 完整 JSON 配置（推荐用于 Vercel）
    // 设置环境变量 CMCC_CONFIG = '{"authorization":"Bearer xxx","cookie":"xxx","tmdb_key":"xxx"}'
    if (process.env.CMCC_CONFIG) {
      const config = JSON.parse(process.env.CMCC_CONFIG);
      return NextResponse.json(config);
    }

    // 方式2: 分开的环境变量
    if (process.env.CMCC_AUTH && process.env.CMCC_COOKIE) {
      return NextResponse.json({
        authorization: process.env.CMCC_AUTH,
        cookie: process.env.CMCC_COOKIE,
        tmdb_key: process.env.TMDB_KEY || '',
        headers: process.env.CMCC_HEADERS ? JSON.parse(process.env.CMCC_HEADERS) : {}
      });
    }

    // 方式3: 本地/Docker 从文件读取
    const configPath = process.env.CONFIG_PATH;
    const candidates = [
        configPath,
        path.join(process.cwd(), 'config/cmcc_config.json'),
        path.join(process.cwd(), 'cmcc_config.json'),
        'd:\\CodeBarn\\Handful-Scripting\\emby-tools\\cmcc_config.json',
        path.join(process.cwd(), '../emby-tools/cmcc_config.json'),
    ].filter(Boolean) as string[];

    let config = null;
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            const content = fs.readFileSync(p, 'utf-8');
            config = JSON.parse(content);
            break;
        }
    }

    if (!config) {
        return NextResponse.json({ 
          error: '配置未找到。请设置环境变量 CMCC_CONFIG 或提供配置文件。' 
        }, { status: 404 });
    }

    return NextResponse.json(config);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
