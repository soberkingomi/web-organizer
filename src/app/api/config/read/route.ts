import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // 优先级1: GitHub Gist（适用于 Vercel）
    const gistId = process.env.GIST_ID;
    const githubToken = process.env.GITHUB_TOKEN;

    if (gistId && githubToken) {
      try {
        const gistUrl = `https://api.github.com/gists/${gistId}`;
        const response = await fetch(gistUrl, {
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
          },
          next: { revalidate: 0 } // 不缓存，确保实时性
        });

        if (response.ok) {
          const gistData = await response.json();
          const configFile = gistData.files['cmcc_config.json'];
          if (configFile) {
            return NextResponse.json(JSON.parse(configFile.content));
          }
        }
      } catch (gistError) {
        console.error('从 Gist 读取失败，降级到其他方式:', gistError);
      }
    }

    // 优先级2: 完整 JSON 配置（环境变量）
    if (process.env.CMCC_CONFIG) {
      const config = JSON.parse(process.env.CMCC_CONFIG);
      return NextResponse.json(config);
    }

    // 优先级3: 分开的环境变量
    if (process.env.CMCC_AUTH && process.env.CMCC_COOKIE) {
      return NextResponse.json({
        authorization: process.env.CMCC_AUTH,
        cookie: process.env.CMCC_COOKIE,
        tmdb_key: process.env.TMDB_KEY || '',
        headers: process.env.CMCC_HEADERS ? JSON.parse(process.env.CMCC_HEADERS) : {}
      });
    }

    // 优先级4: 本地文件（开发环境）
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
          error: '配置未找到。请设置 GIST_ID + GITHUB_TOKEN 或 CMCC_CONFIG 环境变量。' 
        }, { status: 404 });
    }

    return NextResponse.json(config);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
