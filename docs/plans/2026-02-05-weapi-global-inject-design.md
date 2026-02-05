# weapp-vite 默认全局注入 wpi 设计

## 背景与目标

- 默认在 weapp-vite 构建产物中全局注入 `wpi`，项目内无需显式 import 即可使用。
- 可选让 `@wevu/api` 直接替代 `wx`，同时保留原始平台对象以避免递归。
- 保持生产/开发一致行为，并确保类型提示可用。

## 方案概述

- **注入位置**：仅在 App 入口脚本注入一次，避免多文件重复执行。
- **注入内容**：在入口顶部 prepend 初始化代码，设置 `globalThis.wpi`，可选 `globalThis.wx = wpi`。
- **可配置**：新增 `weapp.injectWeapi` 配置项，支持开关与替换策略。

## 运行时注入逻辑

1. 读取 `globalThis`（兼容环境）并缓存 `rawWx = globalThis.wx`。
2. 引入 `@wevu/api` 的 `wpi`。
3. 若 `globalThis.wpi` 未设置，则执行：
   - `wpi.setAdapter(rawWx, platform)`（平台来自 `configService.platform`）。
   - `globalThis.wpi = wpi`。
   - 若 `replaceWx = true`，则 `globalThis.wx = wpi`。
4. guard 防止重复注入与重复替换。

## 类型增强

- 在 `weapp-vite/client.d.ts` 增加 `declare const wpi: import('@wevu/api').WeapiInstance`。
- 若启用 `replaceWx`，推荐追加 `declare const wx: import('@wevu/api').WeapiInstance`（可由配置控制生成）。
- 若用户未安装 `@wevu/api`，构建阶段输出警告并跳过注入。

## 变更点

- 新增配置：`weapp.injectWeapi?: { enabled?: boolean; replaceWx?: boolean; globalName?: string }`。
- 在 App 入口 load/transform 阶段注入代码（优先 `createLoadHook`）。
- `weapp-vite/client.d.ts` 增加全局 `wpi` 声明（以及可选 `wx`）。
- 若 `@wevu/api` 解析失败，构建时 warn 并不阻断。

## 错误处理与边界

- `rawWx` 不存在时仅注入 `wpi`，不替换 `wx`。
- 替换 `wx` 前必须保留 `rawWx`，避免 `wpi.setAdapter(wx)` 导致自引用。
- Guard：`if (!globalThis.wpi)` 防止多入口重复执行。

## 测试建议

- 单测：验证注入片段只插入 App 入口。
- 运行时：验证 `globalThis.wpi` 存在、Promise 调用工作、`replaceWx` 开关生效。
- 类型：验证 `wpi` 全局提示与 `wx` 替换提示（可选）正确。
