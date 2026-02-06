---
"weapp-ide-cli": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

feat: 支持支付宝平台一键打开 IDE，并优化 lib-mode 测试产物稳定性。

- `weapp-ide-cli` 新增 `open --platform alipay` 分流能力，自动转发到 `minidev ide`。
- `weapp-vite` 新增 `open --platform <platform>`，且在 `dev/build --open -p alipay` 场景自动走支付宝 IDE 打开链路。
- `weapp-vite` 的 `injectWeapi` 在 app 注入阶段新增原生平台 API 兜底探测，避免支付宝环境下 `wpi` 未绑定原生 `my` 导致 `setClipboardData:fail method not supported`。
- `weapp-vite` 的 `lib-mode` 测试改为写入临时输出目录，避免每次单测改写 fixture 内的 `.d.ts` 文件。
