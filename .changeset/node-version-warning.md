---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): Node.js 版本偏低时提示升级并继续运行。

CLI（含 `prepare`）与 Tailwind 集成不再仅因 Node.js 版本超出官方支持范围而阻断运行，并提示升级至受支持 LTS 分支的最新安全补丁版本。保留依赖加载和执行错误的原有处理；`engines.node`、Vite+ 支持范围与严格消费者 CI 保持不变。

同步项目入门及随包文档，并联动脚手架版本，使新建项目获取更新后的框架行为。
