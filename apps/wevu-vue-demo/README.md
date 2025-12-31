# WeVu Vue Demo

使用 `weapp-vite` 内置的 Vue 支持自动把 `.vue` 单文件组件编译成微信小程序的多文件结构。

## 快速开始

```bash
pnpm install
pnpm --filter wevu-vue-demo dev
```

## 主要看点

- `src/app.ts` 应用入口
- `src/app.vue` 应用根组件
- `src/pages/index.vue` 展示了 `data`、`computed`、`methods`、`watch` 等用法
- `<json>` 自定义块自动编译成页面 JSON 配置
- 通过 `@weapp-vite/volar` 获取 `<json>` 类型提示

## 技术栈

- **构建工具**: weapp-vite (内置 Vue 支持)
- **运行时**: wevu
