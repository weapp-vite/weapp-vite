---
'@weapp-vite/acceptance': minor
'@weapp-vite/mcp': major
'create-weapp-vite': patch
'weapp-vite': minor
---

feat(upload)!: 升级上传、预览和验收命令的配置、环境变量及超时契约；MCP 升级为 major，验收包与 MCP 最低 Node.js 版本调整为 22.12.0。

- 验收迁移至 Execa 10，取消或超时同时清理本次后代进程，超时后即使子命令返回零退出码也记录失败。
- 上传/预览迁移至 dotenv-expand 1000，环境文件支持命令替换，以及提供 `DOTENV_PRIVATE_KEY` 时解密 `encrypted:` 值；区分空值和未设置变量，解析及跨文件覆盖遵循有效声明顺序，引用复用命令输出和解密结果。
- 已有进程变量（包括空字符串）优先，不执行被覆盖的文件值且不修改全局环境。迁移时请先声明基础变量；需要原样传入包含命令文本的凭据时使用 CI Secrets 或进程变量，不经文件二次引用。
