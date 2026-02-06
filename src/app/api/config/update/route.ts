import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { authorization, cookie, tmdb_key, account_encrypt, headers } = body;

    if (!authorization && !cookie && !tmdb_key) {
      return NextResponse.json(
        { error: '至少需要提供一个字段进行更新' },
        { status: 400 }
      );
    }

    // 查找配置文件路径
    const configPath = process.env.CONFIG_PATH;
    const candidates = [
      configPath,
      path.join(process.cwd(), 'config/cmcc_config.json'),
      path.join(process.cwd(), 'cmcc_config.json'),
      'd:\\CodeBarn\\Handful-Scripting\\emby-tools\\cmcc_config.json',
      path.join(process.cwd(), '../emby-tools/cmcc_config.json'),
    ].filter(Boolean) as string[];

    let targetPath: string | null = null;
    let existingConfig: any = {};

    // 寻找现有配置文件
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        targetPath = p;
        const content = fs.readFileSync(p, 'utf-8');
        existingConfig = JSON.parse(content);
        break;
      }
    }

    // 如果没找到，使用默认路径
    if (!targetPath) {
      targetPath = path.join(process.cwd(), 'config/cmcc_config.json');
    }

    // 更新配置
    const updatedConfig = {
      ...existingConfig,
      ...(authorization !== undefined && { authorization }),
      ...(cookie !== undefined && { cookie }),
      ...(tmdb_key !== undefined && { tmdb_key }),
      ...(account_encrypt !== undefined && { account_encrypt }),
      ...(headers !== undefined && { headers }),
    };

    // 写入文件
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(targetPath, JSON.stringify(updatedConfig, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      message: '配置已更新',
      path: targetPath,
      config: updatedConfig
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
