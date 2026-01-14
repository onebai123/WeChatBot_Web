# WeChatBot Web 模拟器 (Next.js 版)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/onebai123/WeChatBot_Web)

- 项目声明
本项目仅供技术研究与学习交流 ▸ 禁止用于任何违法或违反道德的场景 ▸ 生成内容不代表开发者立场。
角色版权归属原始创作者 ▸ 使用者需对自身行为负全责 ▸ 未成年人应在监护下使用。
禁止将本项目用于任何违法用途，包括但不限于：
传播违法信息
侵犯他人合法权益
违反公序良俗的行为。
本项目为 开源技术工具，仅提供大语言模型的 调用、调度与自动化处理能力。
所有模型输出均由用户自行触发并接收，其使用后果由用户自行承担。
本项目不对第三方模型的输出内容承担责任。
项目作者不参与用户的具体使用行为。
生成内容不代表项目作者或原作者立场。
使用者需自行确保其使用行为符合当地法律法规。

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


