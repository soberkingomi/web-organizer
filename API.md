# API 文档

本文档详细说明了 web-organizer 项目中所有 API 接口的使用方法。

---

## 📡 API 概览

所有 API 都遵循 RESTful 风格，使用 JSON 格式进行数据交换。

### 基础路径
- 开发环境: `http://localhost:3000/api`
- Docker 部署: `http://localhost:5656/api`

### 通用响应格式

**成功响应**:
```json
{
  "success": true,
  "logs": ["操作日志1", "操作日志2"],
  "data": { ... }
}
```

**错误响应**:
```json
{
  "error": "错误信息描述",
  "success": false
}
```

---

## 🔐 认证相关

### POST /api/cmcc/auth

验证 139云盘凭证是否有效。

**请求体**:
```json
{
  "authorization": "Basic xxx...",
  "cookie": "完整Cookie字符串",
  "headers": {
    "x-yun-channel-source": "10000034",
    "mcloud-version": "7.17.0"
  }
}
```

**响应**:
```json
{
  "success": true
}
```

**错误码**:
- `401`: 认证失败，凭证无效
- `500`: 服务器内部错误

---

## 📁 文件管理

### POST /api/cmcc/files

获取指定目录下的文件列表。

**请求体**:
```json
{
  "authorization": "Basic xxx...",
  "cookie": "完整Cookie字符串",
  "fileId": "root",
  "headers": { ... }
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| authorization | string | ✅ | 139云盘授权令牌 |
| cookie | string | ✅ | 完整Cookie字符串 |
| fileId | string | ✅ | 文件夹ID，根目录为 "root" |
| headers | object | ❌ | 额外的请求头 |

**响应**:
```json
{
  "items": [
    {
      "file_id": "xxx",
      "name": "文件名",
      "is_dir": true,
      "size": 1024,
      "updated_at": "2024-01-01 12:00:00"
    }
  ]
}
```

**文件项字段说明**:
| 字段 | 类型 | 说明 |
|------|------|------|
| file_id | string | 文件/文件夹唯一ID |
| name | string | 文件/文件夹名称 |
| is_dir | boolean | 是否为目录 |
| size | number | 文件大小（字节），目录为0 |
| updated_at | string | 最后修改时间 |

---

## 🎬 剧集整理

### POST /api/organize/series

自动整理剧集文件夹，包括识别、重命名、分季、清理垃圾等操作。

**请求体**:
```json
{
  "authorization": "Basic xxx...",
  "cookie": "完整Cookie字符串",
  "folderId": "xxx",
  "folderName": "权力的游戏.S01",
  "tmdbKey": "你的TMDB_API_KEY（可选）",
  "dryRun": true,
  "headers": { ... }
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| authorization | string | ✅ | 139云盘授权令牌 |
| cookie | string | ✅ | 完整Cookie字符串 |
| folderId | string | ✅ | 要整理的文件夹ID |
| folderName | string | ✅ | 文件夹名称 |
| tmdbKey | string | ❌ | TMDB API密钥，用于识别剧集 |
| dryRun | boolean | ❌ | 试运行模式，默认true |
| headers | object | ❌ | 额外的请求头 |

**响应**:
```json
{
  "success": true,
  "logs": [
    {
      "type": "info",
      "description": "处理剧集: 权力的游戏.S01"
    },
    {
      "type": "rename",
      "description": "[DRY] 重命名文件夹: 权力的游戏.S01 -> 权力的游戏 (2011) [TMDB-1399]"
    },
    {
      "type": "mkdir",
      "description": "[DRY] 创建目录 S01"
    },
    {
      "type": "move",
      "description": "[DRY] 移动 ep01.mp4 -> S01/"
    },
    {
      "type": "rename",
      "description": "[DRY] 重命名: ep01.mp4 -> 权力的游戏 - S01E01 - 1080p.mp4"
    }
  ]
}
```

**日志类型**:
| 类型 | 说明 | 颜色 |
|------|------|------|
| info | 一般信息 | 灰色 |
| rename | 重命名操作 | 绿色 |
| move | 移动操作 | 蓝色 |
| mkdir | 创建目录 | 蓝色 |
| clean | 清理垃圾 | 黄色 |
| skip | 跳过项目 | 灰色 |
| error | 错误信息 | 红色 |

**整理流程**:
1. 使用 TMDB API 识别剧集名称和年份
2. 重命名主文件夹为标准格式：`剧名 (年份) [TMDB-ID]`
3. 清理垃圾文件和目录
4. 解析文件名中的季集信息
5. 创建/规范化季文件夹（S01, S02...）
6. 移动视频和字幕文件到对应季文件夹
7. 重命名文件为标准格式：`剧名 - SxxEyy - 质量.扩展名`

**支持的文件名格式**:
- `S01E01`, `S1E1` - 标准格式
- `EP01`, `E01` - 简化格式
- `第01集`, `第1集` - 中文格式
- `name-01.mp4` - 末尾数字
- `01.mp4` - 纯数字

---

## 🎥 电影整理

### POST /api/organize/movie

自动整理电影文件夹，支持单部电影和电影合集。

**请求体**:
```json
{
  "authorization": "Basic xxx...",
  "cookie": "完整Cookie字符串",
  "folderId": "xxx",
  "folderName": "盗梦空间.2010.1080p",
  "tmdbKey": "你的TMDB_API_KEY（可选）",
  "dryRun": true,
  "headers": { ... }
}
```

**参数说明**: 同剧集整理

**响应**:
```json
{
  "success": true,
  "logs": [
    {
      "type": "info",
      "description": "处理电影: 盗梦空间.2010.1080p"
    },
    {
      "type": "rename",
      "description": "[DRY] 重命名文件夹: 盗梦空间.2010.1080p -> 盗梦空间 (2010) [TMDB-27205]"
    },
    {
      "type": "rename",
      "description": "[DRY] 重命名: movie.mkv -> 盗梦空间 (2010) - 1080p.mkv"
    }
  ]
}
```

**整理流程**:

**单部电影**:
1. 从文件夹名提取电影名和年份
2. 使用 TMDB API 识别电影信息
3. 重命名文件夹为：`电影名 (年份) [TMDB-ID]`
4. 清理垃圾文件
5. 重命名视频文件为：`电影名 (年份) - 质量.扩展名`

**电影合集** (检测到 "合集"、"Collection" 等关键词):
1. 保留合集文件夹
2. 为每个视频文件创建独立的电影文件夹
3. 移动并重命名视频文件

**年份提取正则**: `/(19\d{2}|20\d{2})/`

**质量标签识别**:
- `4K`, `2160p` → `4K`
- `1080p` → `1080p`
- `720p` → `720p`

---

## 🗑️ 清理垃圾

### POST /api/clean

递归清理指定目录下的所有垃圾文件和目录。

**请求体**:
```json
{
  "authorization": "Basic xxx...",
  "cookie": "完整Cookie字符串",
  "folderId": "xxx",
  "dryRun": true,
  "headers": { ... }
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| authorization | string | ✅ | 139云盘授权令牌 |
| cookie | string | ✅ | 完整Cookie字符串 |
| folderId | string | ✅ | 要清理的文件夹ID |
| dryRun | boolean | ❌ | 试运行模式，默认true |
| headers | object | ❌ | 额外的请求头 |

**响应**:
```json
{
  "success": true,
  "logs": [
    "Found junk: www.torrent.com.txt",
    "Found junk: @eadir",
    "[DRY] Removing 2 items from xxx",
    "✓ 清理完成！共发现 2 个垃圾项"
  ]
}
```

**垃圾识别规则**:

**垃圾目录** (MISC_DIR_NAMES):
```
@eadir, __macosx, .ds_store, sample, samples,
screens, screen, screenshots, extras, extra,
bonus, bts, poster, posters, fanart, thumb,
thumbs, artwork, cd1, cd2, subs, sub,
subtitle, subtitles, 字幕, 字幕组
```

**垃圾文件标记** (JUNK_MARKERS):
```
www., .com, .net, .org, dygm, dygod,
ygdy8, piaohua, 迅雷, 下载, 资源,
首发, .pdf, .txt, 免费, 搜索
```

**清理流程**:
1. 递归遍历所有子目录
2. 检查目录名是否在垃圾目录集合中
3. 检查文件名是否包含垃圾标记
4. 批量删除识别出的垃圾项
5. 返回清理日志

---

## ⚙️ 配置管理

### GET /api/config/read

读取服务器配置文件（仅在 Docker 环境中可用）。

**请求**: 无需参数

**响应**:
```json
{
  "authorization": "Basic xxx...",
  "cookie": "完整Cookie字符串",
  "tmdb_key": "TMDB_API_KEY",
  "root_id": "根目录ID",
  "headers": { ... }
}
```

**说明**:
- 仅在配置了 `CONFIG_PATH` 环境变量时可用
- 用于 Docker 部署时自动加载配置
- 本地开发环境通常返回空对象

---

## 🔧 技术细节

### 签名算法 (Mcloud-Sign)

139云盘 API 需要在每个请求中包含签名，格式为：

```
Mcloud-Sign: {timestamp},{random},{signature}
```

**签名生成流程**:

1. **准备数据**
   ```typescript
   const timeStr = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
   const randomStr = generateRandomString(16);
   const signPayload = { /* API specific data */ };
   ```

2. **生成签名字符串**
   ```typescript
   const rEncoded = encodeURIComponent(JSON.stringify(signPayload));
   const rSorted = rEncoded.split('').sort().join('');
   ```

3. **计算哈希**
   ```typescript
   const rB64 = Buffer.from(rSorted).toString('base64');
   const d = md5(rB64);
   const f = md5(`${timeStr}:${randomStr}`);
   const signature = md5(d + f).toUpperCase();
   ```

4. **组合签名**
   ```typescript
   const mcloudSign = `${timeStr},${randomStr},${signature}`;
   ```

### 请求头模板

```javascript
{
  "Content-Type": "application/json;charset=UTF-8",
  "Authorization": "Basic xxx...",
  "Cookie": "完整Cookie...",
  "Mcloud-Sign": "{timestamp},{random},{signature}",
  "User-Agent": "Mozilla/5.0...",
  "Accept": "application/json, text/plain, */*",
  "x-yun-channel-source": "10000034",
  "mcloud-version": "7.17.0",
  "x-yun-client-info": "...",
  "mcloud-client": "10701",
  "x-inner-ntwk": "2",
  "mcloud-channel": "1000101"
}
```

### 错误处理

所有 API 都包含完善的错误处理机制：

1. **超时控制**: 30秒（文件操作），15秒（TMDB查询）
2. **自动重试**: 失败后最多重试3次
3. **递增等待**: 每次重试等待 1秒 × 尝试次数
4. **任务异步**: 批量操作通过任务队列异步处理

**示例代码**:
```typescript
for (let attempt = 1; attempt <= retries; attempt++) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(30000)
    });
    return await res.json();
  } catch (e) {
    if (attempt === retries) throw e;
    await new Promise(r => setTimeout(r, 1000 * attempt));
  }
}
```

---

## 📊 API 使用示例

### JavaScript 示例

```javascript
// 1. 登录验证
const authResponse = await fetch('/api/cmcc/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    authorization: 'Basic xxx...',
    cookie: '完整Cookie...'
  })
});

// 2. 获取文件列表
const filesResponse = await fetch('/api/cmcc/files', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    authorization: 'Basic xxx...',
    cookie: '完整Cookie...',
    fileId: 'root'
  })
});
const { items } = await filesResponse.json();

// 3. 整理剧集（试运行）
const organizeResponse = await fetch('/api/organize/series', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    authorization: 'Basic xxx...',
    cookie: '完整Cookie...',
    folderId: 'xxx',
    folderName: '权力的游戏.S01',
    tmdbKey: 'your_tmdb_key',
    dryRun: true
  })
});
const { logs } = await organizeResponse.json();
console.log(logs);
```

### cURL 示例

```bash
# 登录验证
curl -X POST http://localhost:3000/api/cmcc/auth \
  -H "Content-Type: application/json" \
  -d '{
    "authorization": "Basic xxx...",
    "cookie": "完整Cookie..."
  }'

# 获取文件列表
curl -X POST http://localhost:3000/api/cmcc/files \
  -H "Content-Type: application/json" \
  -d '{
    "authorization": "Basic xxx...",
    "cookie": "完整Cookie...",
    "fileId": "root"
  }'

# 整理剧集
curl -X POST http://localhost:3000/api/organize/series \
  -H "Content-Type: application/json" \
  -d '{
    "authorization": "Basic xxx...",
    "cookie": "完整Cookie...",
    "folderId": "xxx",
    "folderName": "权力的游戏.S01",
    "tmdbKey": "your_tmdb_key",
    "dryRun": true
  }'
```

---

## 🚨 注意事项

1. **凭证安全**: 
   - 不要在公共环境中暴露 Authorization 和 Cookie
   - 建议使用环境变量或配置文件管理凭证

2. **试运行模式**:
   - 首次使用建议开启 `dryRun: true`
   - 检查日志确认操作正确后再执行实际操作

3. **API 限流**:
   - 139云盘可能对频繁请求进行限流
   - 批量操作会自动处理重试

4. **TMDB 配额**:
   - TMDB API 有每日请求限制
   - 建议缓存查询结果

5. **文件锁定**:
   - 正在操作的文件可能被锁定
   - 等待操作完成后再进行新操作

---

## 📚 相关文档

- [README.md](./README.md) - 项目说明和使用指南
- [ARCHITECTURE.md](./ARCHITECTURE.md) - 架构设计文档
- [TMDB API 文档](https://developers.themoviedb.org/3)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)

---

最后更新: 2024-01-19
