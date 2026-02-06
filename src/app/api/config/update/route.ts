import { NextResponse } from 'next/server';

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

    // 检查环境变量
    const gistId = process.env.GIST_ID;
    const githubToken = process.env.GITHUB_TOKEN;

    if (!gistId || !githubToken) {
      return NextResponse.json(
        { error: '未配置 GIST_ID 或 GITHUB_TOKEN 环境变量' },
        { status: 500 }
      );
    }

    // 1. 读取现有配置
    const gistUrl = `https://api.github.com/gists/${gistId}`;
    const getResponse = await fetch(gistUrl, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!getResponse.ok) {
      return NextResponse.json(
        { error: `读取 Gist 失败: ${getResponse.statusText}` },
        { status: getResponse.status }
      );
    }

    const gistData = await getResponse.json();
    const configFile = gistData.files['cmcc_config.json'];
    const existingConfig = configFile ? JSON.parse(configFile.content) : {};

    // 2. 合并配置
    const updatedConfig = {
      ...existingConfig,
      ...(authorization !== undefined && { authorization }),
      ...(cookie !== undefined && { cookie }),
      ...(tmdb_key !== undefined && { tmdb_key }),
      ...(account_encrypt !== undefined && { account_encrypt }),
      ...(headers !== undefined && { headers }),
    };

    // 3. 更新 Gist
    const updateResponse = await fetch(gistUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: {
          'cmcc_config.json': {
            content: JSON.stringify(updatedConfig, null, 2)
          }
        }
      })
    });

    if (!updateResponse.ok) {
      return NextResponse.json(
        { error: `更新 Gist 失败: ${updateResponse.statusText}` },
        { status: updateResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: '配置已更新到 GitHub Gist',
      gist_id: gistId,
      config: updatedConfig
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

