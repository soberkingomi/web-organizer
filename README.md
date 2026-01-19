# 🌩️ Web Organizer - 139云盘智能文件管理助手

<div align="center">

[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2-blue?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker)](https://www.docker.com)

一个现代化的139云盘文件管理助手，专注于影视资源的智能化整理

[功能特性](#-功能特性) • [快速开始](#-快速开始) • [使用指南](#-使用指南) • [架构文档](./ARCHITECTURE.md) • [API文档](./API.md)

</div>

---

## ✨ 功能特性

### 🎬 智能影视整理

- **剧集自动整理**
  - 自动识别剧集名称（支持 TMDB）
  - 规范化文件夹命名：`剧名 (年份) [TMDB-ID]`
  - 自动创建季文件夹：`S01`, `S02`...
  - 统一剧集文件命名：`剧名 - S01E01 - 1080p.mp4`
  - 支持多种集数格式：`S01E01`, `第01集`, `EP01`

- **电影自动整理**
  - 智能识别电影名称和年份
  - 自动处理电影合集
  - 规范化命名：`电影名 (年份) [TMDB-ID]`
  - 质量标签提取：`4K`, `1080p`, `HDR`

### 🧹 智能清理

- 自动识别并清理垃圾文件
- 删除无用目录：`@eadir`, `sample`, `screens`
- 过滤广告文件：包含 `www`, `迅雷`, `下载` 等标记

### 🎨 现代化界面

- 💎 精致的暗色/亮色主题
- 📱 响应式设计，支持移动端
- ⚡ 流畅的动画和交互
- 🔄 实时操作日志
- 🎯 批量选择和操作

### 🔒 安全可靠

- 试运行模式：预览操作不实际修改
- 完整的操作日志
- 失败重试机制
- 本地凭证存储

---

## 🚀 快速开始

### 方式一：Docker 部署（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/soberkingomi/web-organizer.git
cd web-organizer

# 2. 配置凭证（可选，也可以在网页中输入）
cp config/cmcc_config.json.example config/cmcc_config.json
# 编辑 config/cmcc_config.json 填入你的凭证

# 3. 启动服务
docker-compose up -d

# 4. 访问应用
# 浏览器打开: http://localhost:5656
```

### 方式二：本地开发

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev

# 3. 访问应用
# 浏览器打开: http://localhost:3000
```

---

## 📖 使用指南

### 1️⃣ 登录配置

首次使用需要配置 139云盘凭证：

1. **获取 Authorization 和 Cookie**
   - 打开浏览器，登录 [139云盘网页版](https://yun.139.com)
   - 按 F12 打开开发者工具
   - 切换到 "Network" 标签
   - 刷新页面，找到任意请求
   - 在请求头中复制 `Authorization` 和 `Cookie` 的值

2. **（可选）获取 TMDB API Key**
   - 注册 [TMDB](https://www.themoviedb.org) 账户
   - 在设置中申请 API Key
   - 用于自动识别剧集/电影信息

3. **填写登录表单**
   - 粘贴 Authorization 和 Cookie
   - 可选填写 TMDB API Key
   - 可选填写根目录 ID（留空则从根目录开始）

### 2️⃣ 浏览文件

登录后进入文件浏览界面：

- 📁 点击文件夹进入
- 🔝 点击面包屑导航快速跳转
- 🔄 点击刷新按钮更新列表
- ✅ 点击"选择"进入批量选择模式

### 3️⃣ 整理文件

#### 剧集整理

1. 进入剧集所在文件夹
2. **建议先开启试运行**（默认开启）
3. 点击 📺 **剧集整理**按钮
4. 查看日志确认操作正确
5. 关闭试运行，再次点击执行实际操作

**整理效果示例**：

```
整理前:
└── 权力的游戏.S01.1080p/
    ├── Game.of.Thrones.S01E01.1080p.mp4
    ├── Game.of.Thrones.S01E02.1080p.mp4
    ├── www.torrent.com.txt
    └── sample/

整理后:
└── 权力的游戏 (2011) [TMDB-1399]/
    └── S01/
        ├── 权力的游戏 - S01E01 - 1080p.mp4
        └── 权力的游戏 - S01E02 - 1080p.mp4
```

#### 电影整理

1. 进入电影所在文件夹
2. 开启试运行（建议）
3. 点击 🎬 **电影整理**按钮
4. 确认后执行实际操作

**整理效果示例**：

```
整理前:
└── 肖申克的救赎.1994.BluRay.1080p/
    ├── The.Shawshank.Redemption.1994.1080p.mkv
    └── poster.jpg

整理后:
└── 肖申克的救赎 (1994) [TMDB-278]/
    └── 肖申克的救赎 (1994) - 1080p.mkv
```

#### 清理垃圾

1. 进入需要清理的文件夹
2. 点击 🗑️ **清理垃圾**按钮
3. 自动递归清理所有子文件夹

### 4️⃣ 批量操作

1. 点击工具栏的"选择"按钮
2. 勾选多个文件/文件夹
3. 点击整理按钮批量处理
4. 点击"完成"退出选择模式

### 5️⃣ 查看日志

- 点击右上角 🖥️ **日志**按钮打开日志面板
- 实时查看操作进度
- 绿色表示成功，红色表示错误
- 可随时点击"停止"按钮中断操作

---

## ⚙️ 配置说明

### 配置文件格式

创建 `config/cmcc_config.json`：

```json
{
  "authorization": "Basic xxx...",
  "cookie": "完整的Cookie字符串...",
  "account_encrypt": "MTU3...",
  "tmdb_key": "你的TMDB API Key（可选）",
  "root_id": "根目录ID（可选）",
  "headers": {
    "x-yun-channel-source": "10000034",
    "mcloud-version": "7.17.0"
  }
}
```

### 环境变量

```bash
# Docker 环境
CONFIG_PATH=/app/config/cmcc_config.json  # 配置文件路径
NODE_ENV=production                        # 运行环境
PORT=3000                                  # 服务端口
```

---

## 🛠️ 技术栈

- **前端**: React 19 + Next.js 16 + TypeScript
- **UI**: CSS Variables + lucide-react
- **API**: Next.js API Routes
- **运行时**: Node.js 20
- **容器**: Docker + Docker Compose

详细架构说明请查看 [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 📊 项目结构

```
web-organizer/
├── src/
│   ├── app/              # Next.js App Router
│   ├── components/       # React 组件
│   ├── contexts/         # React Contexts
│   └── lib/              # 核心库
│       ├── cmcc/         # 139云盘客户端
│       ├── tmdb/         # TMDB客户端
│       └── parsers.ts    # 文件名解析
├── config/               # 配置目录
├── public/               # 静态资源
└── Dockerfile            # Docker配置
```

---

## 🎯 命名规则说明

### 剧集命名规则

**文件夹**: `剧名 (首播年份) [TMDB-ID]`
- 例：`权力的游戏 (2011) [TMDB-1399]`

**季文件夹**: `Sxx`（两位数）
- 例：`S01`, `S02`, `S10`

**视频文件**: `剧名 - SxxEyy - 质量标签.扩展名`
- 例：`权力的游戏 - S01E01 - 1080p.mkv`
- 无质量标签：`权力的游戏 - S01E01.mkv`

### 电影命名规则

**文件夹**: `电影名 (年份) [TMDB-ID]`
- 例：`盗梦空间 (2010) [TMDB-27205]`

**视频文件**: `电影名 (年份) - 质量标签.扩展名`
- 例：`盗梦空间 (2010) - 4K.mkv`
- 无质量标签：`盗梦空间 (2010).mkv`

---

## 🔍 支持的格式

### 视频格式
`.mp4`, `.mkv`, `.avi`, `.mov`, `.wmv`, `.flv`, `.m4v`, `.ts`, `.m2ts`, `.webm`, `.rmvb`, `.iso`

### 字幕格式
`.srt`, `.ass`, `.ssa`, `.vtt`, `.sub`, `.idx`, `.sup`

### 识别格式
- **季集格式**: `S01E01`, `Season 1`, `第1季`, `第一季`
- **集数格式**: `S01E01`, `EP01`, `E01`, `第01集`, `01`
- **年份格式**: `(2020)`, `[2020]`, `.2020.`

---

## 🐛 故障排查

### 1. 登录失败

**问题**: 提示"登录失败，请检查凭证"

**解决方案**:
- 确认 Authorization 和 Cookie 正确复制
- 确保 Cookie 包含完整内容
- 尝试重新登录139云盘网页版获取新凭证

### 2. 文件识别错误

**问题**: 剧集/电影名称识别错误

**解决方案**:
- 确保文件夹名称包含基本信息（名称+年份）
- 配置 TMDB API Key 提高识别准确度
- 手动重命名文件夹为标准格式

### 3. TMDB 搜索失败

**问题**: 无法从 TMDB 获取信息

**解决方案**:
- 检查 TMDB API Key 是否有效
- 检查网络连接
- 不配置 TMDB Key 也可使用，但准确度降低

### 4. Docker 启动失败

**问题**: `docker-compose up` 失败

**解决方案**:
```bash
# 查看日志
docker-compose logs

# 重新构建
docker-compose build --no-cache

# 清理并重启
docker-compose down
docker-compose up -d
```

---

## 📝 开发指南

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 代码检查
npm run lint

# 构建生产版本
npm run build
npm start
```

### 代码规范

- 使用 TypeScript 严格模式
- 遵循 ESLint 配置
- 组件使用函数式写法
- 使用 CSS Variables 管理主题

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建特性分支：`git checkout -b feature/AmazingFeature`
3. 提交更改：`git commit -m 'Add some AmazingFeature'`
4. 推送到分支：`git push origin feature/AmazingFeature`
5. 提交 Pull Request

---

## 📄 许可证

本项目仅供学习交流使用。

---

## 🙏 鸣谢

- [Next.js](https://nextjs.org) - React 框架
- [TMDB](https://www.themoviedb.org) - 电影数据库
- [lucide-react](https://lucide.dev) - 图标库

---

## 📞 联系方式

如有问题或建议，欢迎提交 [Issue](https://github.com/soberkingomi/web-organizer/issues)

---

<div align="center">

**⭐ 觉得不错？给个 Star 吧！**

Made with ❤️ by [soberkingomi](https://github.com/soberkingomi)

</div>
