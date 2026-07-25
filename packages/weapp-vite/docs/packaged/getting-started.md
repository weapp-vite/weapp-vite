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

### Web 预览与构建

项目根目录准备引用 `/@weapp-vite/web/entry` 的 `index.html` 后，可以复用原有小程序源码：

```bash
wv dev -p h5 --host
wv build -p h5
```

推荐将两条命令分别固定为 `dev:web` 和 `build:web` scripts。`-p web` 与 `-p h5` 等价，Web runtime 适合浏览器兼容验证，但不替代微信 DevTools 或真机验收。

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
wv dev -p h5 --host
wv build -p h5
weapp-vite open
weapp-vite preview --project ./dist/build/mp-weixin
weapp-vite ide preview --project ./dist/build/mp-weixin
weapp-vite ide logs --open
weapp-vite screenshot --project ./dist/build/mp-weixin --page pages/index/index --output .tmp/acceptance.png --json
weapp-vite mcp
```
