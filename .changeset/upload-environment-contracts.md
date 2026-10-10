---
'@weapp-vite/acceptance': minor
'@weapp-vite/mcp': major
'create-weapp-vite': patch
'weapp-vite': minor
---

升级上传、预览和验收命令的配置、环境变量及超时契约；MCP 升级为 major，验收包与 MCP 最低 Node.js 版本调整为 22.12.0。

- 验收迁移至 Execa 10，取消或超时同时清理本次后代进程，超时后即使子命令返回零退出码也记录失败。
- 上传/预览迁移至 dotenv-expand 1000，环境文件支持命令替换，以及提供 `DOTENV_PRIVATE_KEY` 时解密 `encrypted:` 值；区分空值和未设置变量，解析及跨文件覆盖遵循有效声明顺序，引用复用命令输出和解密结果。
- 已有进程变量（包括空字符串）优先，不执行被覆盖的文件值且不修改全局环境。迁移时请先声明基础变量；需要原样传入包含命令文本的凭据时使用 CI Secrets 或进程变量，不经文件二次引用。
- `project.private.config.json` 按官方语义优先于基础配置，并深合并 `setting`，保留双方编译选项；`wv build --upload --bump` 在配置求值前更新版本，使配置和产物一致，纯 Web 选择恢复本地清单和 npm 锁文件。
- 独立 `upload` 新增 `--json`、遇错停止的六平台汇总和 `--timeout` 本地期限，统一官方结果、微信任务进度、小红书百分比与支付宝公开事件；保留预览及旧微信 IDE 上传边界。
- 超时/中断清理本地上传进程并明确远端结果未确认，不自动重试、撤回、提审或发布；SDK worker 退出即停止执行计时，避免后续管道/清理误报超时，Windows 身份查询独立有界，清理失败仍保留错误。
