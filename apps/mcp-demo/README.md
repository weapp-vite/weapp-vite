# mcp-demo

`mcp-demo` 是一个专门用于验证 AI 调用 `weapp-vite MCP` 能力的示例项目。

## 验证目标

通过同一个 demo 覆盖以下能力链路：

1. 发现能力：读取 MCP 可用 tools/resources
2. 代码定位：在仓库中检索 demo 页面代码
3. 命令执行：调用 `weapp-vite` 构建 demo
4. 结果验证：检查构建产物是否包含关键页面内容

## 快速开始

在仓库根目录安装依赖后，进入 demo：

```bash
cd apps/mcp-demo
pnpm dev
```

可选命令：

```bash
# 通过 stdio 启动 MCP 服务
pnpm mcp:stdio

# 通过 HTTP 启动 MCP 服务
pnpm mcp:http

# 构建并做冒烟校验
pnpm mcp:smoke
```

## 推荐 AI 测试流程

### 1. MCP 连接

让 AI 客户端连接：

```json
{
  "mcpServers": {
    "weapp-vite": {
      "command": "weapp-vite",
      "args": ["mcp", "--workspace-root", "/absolute/path/to/weapp-vite"]
    }
  }
}
```

### 2. 可直接复制的测试提示词

```text
你现在连接的是 weapp-vite MCP，请对 apps/mcp-demo 做一次完整验证：
1. 调用 workspace_catalog，确认 MCP 服务可用。
2. 用 run_repo_command 执行 rg，定位 apps/mcp-demo/src/pages/index/index.ts。
3. 用 run_weapp_vite_cli 执行 build，目标项目是 apps/mcp-demo，platform=weapp。
4. 用 run_repo_command 检查 dist/pages/index/index.wxml 是否存在。
5. 汇总：执行过的工具、关键输出、最终结论（pass/fail）。
```

### 3. 期望结果

1. AI 能正确列出并调用 MCP tools。
2. `apps/mcp-demo/dist/pages/index/index.wxml` 存在。
3. 页面中包含文案 `MCP AI 调用测试场`。

## 目录结构

```text
apps/mcp-demo
├── scripts/mcp-smoke.mjs         # 构建产物校验脚本
├── src/app.json
├── src/pages/index/index.ts      # MCP 测试信息面板
└── src/pages/index/index.wxml
```
