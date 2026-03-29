# Getting Started

## CLI 别名

`weapp-vite` 和 `wv` 完全等价。

```bash
weapp-vite build
wv build
```

## 最小工作流

### 1. 准备支持文件

```bash
weapp-vite prepare
```

如果项目里存在 `.weapp-vite` 支持文件缺失或过期，这一步会更新它们。

### 2. 本地开发

```bash
weapp-vite dev
weapp-vite dev --open
```

如果需要打开微信开发者工具并把日志桥接回终端，可使用：

```bash
weapp-vite dev --open
weapp-vite ide logs --open
```

### 3. 构建

```bash
weapp-vite build
```

### 4. 截图验收

```bash
weapp-vite screenshot --project ./dist/build/mp-weixin --page pages/index/index --output .tmp/acceptance.png --json
```

### 5. 启动 MCP

```bash
weapp-vite mcp
```

## 何时先读哪些文档

- 命令、脚手架、AI 工作流：[`ai-workflows.md`](./ai-workflows.md)
- 目录结构、`AGENTS.md`、`.weapp-vite`：[`project-structure.md`](./project-structure.md)
- `vite.config.ts` 与 `weapp` 配置：[`weapp-config.md`](./weapp-config.md)
- wevu 页面/组件/store 写法：[`wevu-authoring.md`](./wevu-authoring.md)
- Vue SFC 宏、`definePageMeta`、`v-model`：[`vue-sfc.md`](./vue-sfc.md)

## 常见命令

```bash
weapp-vite dev
weapp-vite dev --open
weapp-vite build
weapp-vite open
weapp-vite preview --project ./dist/build/mp-weixin
weapp-vite ide preview --project ./dist/build/mp-weixin
weapp-vite ide logs --open
weapp-vite screenshot --project ./dist/build/mp-weixin --page pages/index/index --output .tmp/acceptance.png --json
weapp-vite mcp
```
