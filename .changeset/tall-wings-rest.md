---
"weapp-vite": patch
"create-weapp-vite": patch
---

为 `weapp.wevu` 新增独立的 `minify` 与 `runtime` 开关，可按需控制 wevu 编译生成脚本是否压缩，并允许指定 wevu 运行时入口版本。`runtime` 默认使用 `auto`，开发模式走 `wevu/dist/dev` 可读入口，构建模式走默认压缩入口；显式配置为 `dev` 或 `build` 时会覆盖该自动选择。
