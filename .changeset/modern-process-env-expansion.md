---
"@weapp-vite/acceptance": minor
"@weapp-vite/mcp": major
"weapp-vite": minor
"create-weapp-vite": patch
---

升级验收命令执行至 Execa 10，取消或超时时同时清理本次启动的后代进程；超时后即使命令返回零退出码，也会正确记录为失败。验收包和 MCP 的最低 Node.js 版本同步调整为 22.12.0。

上传与预览迁移至 dotenv-expand 1000：环境文件支持命令替换，以及提供 DOTENV_PRIVATE_KEY 时解密 encrypted: 值；空值与未设置变量按新版默认值、替代值规则区分。解析和跨文件覆盖保留有效声明顺序，使后续引用复用命令输出和解密结果。已有进程变量（包括空字符串）优先，不执行被其覆盖的文件值，也不修改全局进程环境。

多级引用请先声明基础变量；需要原样传入包含命令文本的凭据时，直接使用 CI Secrets 或进程变量，不经文件变量二次引用。同步上传指南、随包文档及脚手架联动发布。
