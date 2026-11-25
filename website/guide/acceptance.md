---
title: 小程序改动验收
description: 使用 Vitest、weapp-vite e2e namespace 和真实 DevTools provider 验证小程序改动。
keywords:
  - weapp-vite
  - 验收
  - Vitest
  - e2e
  - DevTools
---

# 小程序改动验收

Codex 等宿主负责编辑代码，Vitest 直接执行 headless runtime 测试，仓库 `e2e/ide` suites 负责真实微信开发者工具运行时验证。两者都以真实 weapp-vite 构建产物为输入。

## Headless 验证

测试文件直接从 `vitest` 导入 `test`、`expect` 和 hooks，从 `weapp-vite/test` 导入产物构建、simulator、查询和交互 API。真实微信开发者工具 automator 从 `weapp-vite/e2e` 导入。模板不需要 `weapp-acceptance.config.json` 或 `acceptance/*.json`。

```bash
pnpm test
```

每个测试先通过 `buildTestArtifact()` 生成真实构建产物，再用 `createTestProject({ artifact })` 创建独立会话，结束时调用 `project.close()`。这层验证页面树、生命周期、事件和交互语义。

## DevTools E2E

真实 IDE 运行复用 `e2e/ide/**` 的 provider-compatible suites。先使用 headless provider 缩小问题，再使用 DevTools provider 验证真实运行时。套件负责构建、启动 automator、复用项目窗口和清理资源，场景断言直接写在 Vitest suite 中。

```bash
pnpm e2e:ide
```

真实 DevTools 运行前需要安装项目依赖、使用真实测试 AppID、登录微信开发者工具并开启服务端口。`weapp-devtools-e2e-best-practices` 负责 provider 选择、宿主复用和运行证据。

旧版 `weapp-agent` 的 `wv accept` 和 MCP acceptance 工具仍保留兼容性，但不参与新模板的测试路径，也不会要求新项目创建 acceptance 配置。

如需使用自定义状态目录，在启动 CLI 时设置 `WEAPP_AGENT_STATE_DIR`，并在宿主 MCP 服务器的 `env` 中显式传入同一值。部分宿主不会继承终端的全部环境变量；目录不一致时服务会要求重新审阅信任记录。
