# 项目架构文档

## 🏗️ 系统架构概览

**web-organizer** 是一个基于 Next.js 14 构建的移动云盘（139云盘）文件管理助手，采用现代化的全栈架构，提供智能化的影视文件整理功能。

### 技术栈

- **前端框架**: Next.js 14 (App Router)
- **UI 库**: React 19
- **样式**: CSS Modules + CSS Variables
- **图标**: lucide-react
- **语言**: TypeScript 5
- **构建工具**: Next.js 内置构建系统
- **运行环境**: Node.js 20+
- **容器化**: Docker + Docker Compose

---

## 📁 项目结构

```
web-organizer/
├── src/
│   ├── app/                      # Next.js App Router 目录
│   │   ├── api/                  # API 路由
│   │   │   ├── clean/           # 清理垃圾文件 API
│   │   │   ├── cmcc/            # 139云盘相关 API
│   │   │   │   ├── auth/        # 身份验证
│   │   │   │   └── files/       # 文件列表
│   │   │   ├── config/          # 配置读取
│   │   │   └── organize/        # 文件整理 API
│   │   │       ├── series/      # 剧集整理
│   │   │       └── movie/       # 电影整理
│   │   ├── layout.tsx           # 根布局组件
│   │   ├── page.tsx             # 首页（入口）
│   │   └── globals.css          # 全局样式
│   │
│   ├── components/              # React 组件
│   │   ├── FileBrowser.tsx      # 文件浏览器（主界面）
│   │   ├── LoginForm.tsx        # 登录表单
│   │   └── ThemeSwitcher.tsx    # 主题切换器
│   │
│   ├── contexts/                # React Contexts
│   │   └── ThemeContext.tsx     # 主题管理上下文
│   │
│   └── lib/                     # 核心库
│       ├── cmcc/                # 139云盘客户端
│       │   └── client.ts        # CMCC API 客户端
│       ├── tmdb/                # TMDB 客户端
│       │   └── client.ts        # TMDB API 客户端
│       └── parsers.ts           # 文件名解析器
│
├── config/                      # 配置文件目录
│   └── cmcc_config.json        # 139云盘配置
│
├── public/                      # 静态资源
├── Dockerfile                   # Docker 镜像定义
├── docker-compose.yml          # Docker Compose 配置
├── next.config.ts              # Next.js 配置
├── tsconfig.json               # TypeScript 配置
└── package.json                # 项目依赖
```

---

## 🔄 核心工作流程

### 1. 用户认证流程

```
用户输入凭证 → LoginForm.tsx
    ↓
发送到 /api/cmcc/auth
    ↓
CmccClient 验证凭证
    ↓
存储到 localStorage
    ↓
跳转到文件浏览器
```

### 2. 文件浏览流程

```
FileBrowser 加载 → 请求 /api/cmcc/files
    ↓
CmccClient.listDir(fileId)
    ↓
返回文件列表
    ↓
渲染文件/文件夹列表
```

### 3. 剧集整理流程

```
用户点击"剧集整理" → /api/organize/series
    ↓
1. 识别剧集名称（使用 TMDB API）
    ↓
2. 重命名主文件夹为标准格式
    ↓
3. 清理垃圾文件
    ↓
4. 解析文件名中的季集信息
    ↓
5. 创建/规范化季文件夹 (S01, S02...)
    ↓
6. 移动并重命名视频/字幕文件
    ↓
返回操作日志
```

### 4. 电影整理流程

```
用户点击"电影整理" → /api/organize/movie
    ↓
1. 识别电影名称和年份（使用 TMDB API）
    ↓
2. 判断是否为合集
    ↓
3a. 单部电影：
    - 重命名文件夹
    - 清理垃圾文件
    - 重命名视频文件
    ↓
3b. 电影合集：
    - 为每个视频创建独立文件夹
    - 移动并重命名文件
    ↓
返回操作日志
```

---

## 🔌 核心模块详解

### 1. CmccClient (139云盘客户端)

**位置**: `src/lib/cmcc/client.ts`

**功能**: 
- 与139云盘 API 交互
- 实现签名算法 (Mcloud-Sign)
- 提供文件操作接口

**关键方法**:
```typescript
class CmccClient {
  listDir(fileId: string): Promise<DirEntry[]>     // 列出目录
  rename(fileId: string, newName: string): void     // 重命名
  mkdir(parentId: string, name: string): string     // 创建目录
  move(fileIds: string[], toParentId: string): void // 移动文件
  remove(fileIds: string[]): void                   // 删除文件
}
```

**签名算法**:
```
1. 构造 sign_payload (JSON)
2. URL 编码并排序字符
3. Base64 编码
4. MD5 哈希
5. 与时间戳和随机数组合
6. 生成最终签名: MD5(d + f).toUpperCase()
```

### 2. TMDBClient (电影数据库客户端)

**位置**: `src/lib/tmdb/client.ts`

**功能**:
- 搜索剧集/电影信息
- 获取详细元数据
- 多语言支持 (默认中文)

**关键方法**:
```typescript
class TMDBClient {
  searchTv(query: string): Promise<any[]>           // 搜索剧集
  searchMovie(query: string, year?: number): any[]  // 搜索电影
  tvDetails(tvId: number): Promise<any>             // 剧集详情
  movieDetails(movieId: number): Promise<any>       // 电影详情
}
```

### 3. 文件名解析器 (parsers.ts)

**位置**: `src/lib/parsers.ts`

**核心功能**:

#### 剧集解析
- **季号解析**: 支持 `S01`, `Season 1`, `第1季`, `第一季` 等格式
- **集数解析**: 支持 `S01E01`, `EP01`, `第01集`, `01` 等格式
- **清理查询**: 移除质量标签、季信息、括号内容

#### 电影解析
- **年份提取**: 识别 `(2020)`, `[2020]` 等格式
- **标题清理**: 移除质量标签 (1080p, 4K, BluRay...)
- **噪音过滤**: 移除编码格式、音频格式等技术信息

#### 质量标签识别
- `4K`, `2160p`, `1080p`, `720p` 等分辨率标签

**关键常量**:
```typescript
VIDEO_EXTS = [".mp4", ".mkv", ".avi", ...]         // 视频格式
SUB_EXTS = [".srt", ".ass", ...]                   // 字幕格式
MISC_DIR_NAMES = ["@eadir", "sample", ...]         // 垃圾目录
JUNK_MARKERS = ["www.", ".com", "迅雷", ...]       // 垃圾文件标记
```

---

## 🎨 UI/UX 设计

### 主题系统

支持三种主题模式：
- **Dark Mode** (暗色模式) - 默认
- **Light Mode** (亮色模式)
- **System** (跟随系统)

**实现方式**:
- CSS Variables 实现主题切换
- ThemeContext 管理主题状态
- localStorage 持久化用户偏好

### 组件设计

#### FileBrowser (主界面)
- **Header**: Logo + 设置菜单
- **Toolbar**: 功能按钮 (剧集/电影/清理) + 选择模式
- **Breadcrumb**: 面包屑导航
- **File List**: 文件列表（虚拟滚动）
- **Logs Panel**: 底部操作日志面板

#### LoginForm (登录表单)
- 简洁的卡片式设计
- 支持配置文件自动加载
- 输入验证和错误提示

---

## 🔐 安全性设计

### 1. 凭证管理
- 敏感信息存储在 `localStorage`
- 支持从配置文件读取（Docker 环境）
- Cookie/Token 不会暴露在日志中

### 2. API 安全
- 所有请求包含签名验证
- 超时控制（30秒）
- 自动重试机制（最多3次）

### 3. Docker 安全
- 使用非 root 用户运行
- 多阶段构建减小镜像体积
- 配置文件挂载（不打包到镜像）

---

## 🚀 部署架构

### Docker 部署

**构建过程**:
```
1. Builder 阶段 (node:20-alpine)
   - 安装依赖
   - 构建 Next.js 应用
   
2. Runner 阶段 (node:20-alpine)
   - 复制构建产物
   - 创建非 root 用户
   - 暴露 3000 端口
```

**运行配置**:
```yaml
services:
  web-organizer:
    ports: "5656:3000"
    volumes: ./config:/app/config
    environment:
      CONFIG_PATH: /app/config/cmcc_config.json
```

---

## 📊 数据流图

### 文件整理数据流

```
用户操作
    ↓
FileBrowser (React Component)
    ↓
API Route (/api/organize/*)
    ↓
┌──────────────────────────────┐
│  CmccClient                  │
│  - listDir()                 │
│  - rename()                  │
│  - move()                    │
│  - mkdir()                   │
└──────────────────────────────┘
    ↓
139云盘 API
    ↓
┌──────────────────────────────┐
│  TMDBClient (可选)           │
│  - searchTv/Movie()          │
│  - getDetails()              │
└──────────────────────────────┘
    ↓
TMDB API
    ↓
返回处理结果和日志
    ↓
FileBrowser 显示日志
```

---

## 🧩 关键算法

### 1. 剧集文件名解析算法

**优先级顺序**:
1. `SxxEyy` 格式 (如 S01E01)
2. 中文格式 (如 "第01集")
3. `EPxx` 格式
4. 文件名末尾数字 (如 "name-01.mp4")
5. 纯数字文件名

### 2. 电影年份提取

**正则表达式**: `/(?:^|[\.\s\(\[])(19\d{2}|20\d{2})(?:$|[\.\s\)\]])/`

**逻辑**:
- 匹配边界处的4位数字
- 范围限制: 1900-2099
- 考虑各种分隔符

### 3. 垃圾文件识别

**判断规则**:
- 目录: 在 `MISC_DIR_NAMES` 集合中
- 文件: 包含 `JUNK_MARKERS` 中的任意标记

---

## 🔧 配置说明

### cmcc_config.json

```json
{
  "authorization": "Basic ...",      // 139云盘授权token
  "cookie": "...",                   // 完整Cookie字符串
  "account_encrypt": "...",          // 加密账户信息
  "headers": {                       // 额外请求头
    "x-yun-channel-source": "...",
    "mcloud-version": "..."
  },
  "tmdb_key": "...",                 // TMDB API密钥（可选）
  "root_id": "..."                   // 根目录ID（可选）
}
```

### 环境变量

- `NODE_ENV`: 运行环境 (production/development)
- `CONFIG_PATH`: 配置文件路径
- `PORT`: 服务端口 (默认 3000)
- `HOSTNAME`: 监听地址 (默认 0.0.0.0)

---

## 🎯 性能优化

### 1. 前端优化
- React 19 Compiler 自动优化
- CSS-in-JS 替代为 CSS Variables
- 图标按需加载 (lucide-react)
- 虚拟滚动（大文件列表）

### 2. API 优化
- 请求重试机制
- 超时控制
- 批量操作接口
- 任务异步处理

### 3. Docker 优化
- 多阶段构建
- 最小化镜像层
- Node.js Standalone 输出
- Alpine Linux 基础镜像

---

## 📝 开发规范

### 命名约定
- **组件**: PascalCase (`FileBrowser.tsx`)
- **工具函数**: camelCase (`parseEpisode()`)
- **常量**: UPPER_SNAKE_CASE (`VIDEO_EXTS`)
- **CSS类**: kebab-case (`.btn-primary`)

### 代码组织
- 单一职责原则
- 功能模块化
- 类型安全（TypeScript）
- 错误处理完善

---

## 🐛 已知限制

1. **文件名解析**: 
   - 复杂格式可能识别错误
   - 依赖正则表达式匹配

2. **TMDB 搜索**:
   - 结果准确性取决于关键词
   - 需要 API Key 才能使用

3. **并发控制**:
   - 大量操作时可能触发 API 限流
   - 暂无队列管理

4. **错误恢复**:
   - 部分失败不会回滚
   - 需手动检查日志

---

## 🔮 未来规划

- [ ] 批量任务队列
- [ ] 操作历史记录
- [ ] 自定义命名模板
- [ ] AI 辅助识别
- [ ] WebDAV 协议支持
- [ ] 移动端优化
- [ ] 插件系统

---

## 📚 参考资料

- [Next.js 文档](https://nextjs.org/docs)
- [React 文档](https://react.dev)
- [TMDB API 文档](https://developers.themoviedb.org)
- [Docker 文档](https://docs.docker.com)
