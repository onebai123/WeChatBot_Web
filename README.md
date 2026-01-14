# WeChatBot Web 模拟器 (Next.js 版)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/onebai123/WeChatBot_Web)


## 🔧 技术栈

- **框架**: Next.js 14 + React 18
- **状态管理**: Zustand
- **样式**: Tailwind CSS
- **图标**: Lucide React
- **AI 接口**: 支持 OpenAI 兼容接口（DeepSeek、GPT 等）

## 🚀 快速开始

### 安装依赖

```bash
npm install
# 或
pnpm install
```

### 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

### 构建生产版本

```bash
npm run build
npm start
```

## 📁 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── globals.css        # 全局样式
│   ├── layout.tsx         # 根布局
│   └── page.tsx           # 主页面
├── components/             # React 组件
│   ├── chat/              # 聊天相关组件
│   │   ├── ChatContainer.tsx   # 聊天容器
│   │   ├── ChatHeader.tsx      # 聊天头部
│   │   ├── ChatInput.tsx       # 输入框
│   │   └── MessageBubble.tsx   # 消息气泡
│   ├── layout/            # 布局组件
│   │   └── Sidebar.tsx         # 侧边栏
│   ├── persona/           # 人设组件
│   │   └── PersonaDrawer.tsx   # 人设抽屉
│   └── settings/          # 设置组件
│       └── SettingsModal.tsx   # 设置弹窗
├── store/                  # Zustand 状态管理
│   ├── chatStore.ts       # 聊天状态
│   ├── configStore.ts     # 配置状态
│   └── personaStore.ts    # 人设状态
├── lib/                    # 工具库
│   ├── api.ts             # API 请求
│   └── utils.ts           # 工具函数
└── types/                  # TypeScript 类型
    └── index.ts           # 类型定义
```


