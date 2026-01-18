import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // 支持环境变量指定配置路径
    const configPath = process.env.CONFIG_PATH;
    const candidates = [
        configPath,  // 环境变量优先
        path.join(process.cwd(), 'config/cmcc_config.json'),
        path.join(process.cwd(), 'cmcc_config.json'),
        'd:\\\\CodeBarn\\\\Handful-Scripting\\\\emby-tools\\\\cmcc_config.json',
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
        return NextResponse.json({ error: 'Config file not found in standard locations.' }, { status: 404 });
    }

    return NextResponse.json(config);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
