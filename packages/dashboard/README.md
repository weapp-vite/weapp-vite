# @weapp-vite/dashboard

`@weapp-vite/dashboard` 是 `weapp-vite` 调试 UI 的可选前端包。

它负责承载 `weapp-vite --ui` 的前端可视化界面，本身不直接参与小程序构建；只有当用户显式安装这个包后，`weapp-vite analyze`、`weapp-vite build --ui`、`weapp-vite dev --ui` 才会自动发现并启动页面。

未安装时，`weapp-vite` 会：

- 提示对应包管理器的安装命令
- 自动降级为仅输出文本或 JSON 分析结果
- 不再因为缺少 dashboard 资源而报错中断

## 安装

按当前项目使用的包管理器安装即可：

```bash
pnpm add -D @weapp-vite/dashboard
```

```bash
npm install -D @weapp-vite/dashboard
```

```bash
yarn add -D @weapp-vite/dashboard
```

```bash
bun add -d @weapp-vite/dashboard
```

## 使用方式

安装后，直接使用 `weapp-vite` 主包的分析命令：

```bash
weapp-vite analyze
```

或在构建/开发时启用分析：

```bash
weapp-vite build --ui
weapp-vite dev --ui

# 兼容旧参数
weapp-vite build --analyze
weapp-vite dev --analyze
```

`weapp-vite` 会在运行时检查当前项目中是否安装了 `@weapp-vite/dashboard`。如果存在，就读取本包 `dist/` 中的静态资源并启动本地分析页面。

## 项目结构

当前目录按标准 Vite 应用方式组织：

```text
packages/dashboard
├── index.html
├── package.json
├── src
│   ├── App.vue
│   ├── env.d.ts
│   ├── main.ts
│   ├── router.ts
│   ├── style.css
│   ├── types.ts
│   ├── useTreemapData.ts
│   └── pages
│       └── index.vue
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

说明：

- `src/pages/`：文件路由页面目录
- `src/router.ts`：基于 `vue-router` 的路由入口
- `src/types.ts`：仪表盘使用的分析结果类型
- `src/useTreemapData.ts`：Treemap 数据整理逻辑
- `dist/`：发布到 npm 的静态产物目录

## 技术栈

- `vite`
- `vue`
- `vue-router`
- `echarts`
- `tailwindcss`

## 开发

在仓库根目录执行：

```bash
pnpm --filter @weapp-vite/dashboard dev
```

生产构建：

```bash
pnpm --filter @weapp-vite/dashboard build
```

## 发布约束

`@weapp-vite/dashboard` 与 `weapp-vite` 共享版本节奏。

仓库里的 changeset 规则已经要求：

- `weapp-vite` 发版时，`@weapp-vite/dashboard` 必须一起发版
- `@weapp-vite/dashboard` 发版时，`weapp-vite` 也必须一起发版
- 两者的 bump 类型必须一致

这样可以保证：

- 主包提示安装的版本与 dashboard 包保持一致
- CLI 的运行时发现逻辑不会因为版本漂移而出问题
- 文档与实际安装体验一致
