---
'@mpcore/weapp-vite': patch
'@weapp-vite/acceptance': patch
'@weapp-vite/mcp': patch
'create-weapp-vite': patch
'weapp-ide-cli': patch
'weapp-vite': patch
---

fix(acceptance): 修复 Doctor 会话清理、HMR profile 交接与测试产物缓存的归属和失效边界。

- Doctor 分阶段保存宿主事实及脱敏清理证据，共享总预算；工具信息失败仍保留已连接事实，释放本次连接而不误删持久化会话。原生 CLI 登录查询仅显式启用，只采信布尔结果，超时或无效响应保持未知。
- 拓扑替换独立移交原始计时与时钟，仅在完整产物发布后结算；保留重启失败、交接失效和关闭诊断。畸形枚举记录被跳过而不影响后续合法样本，异步写入使用已固定快照。
- profile 监听只排除实际启用的输出文件，避免失败重建自触发；关闭 profile 时同名用户文件及相邻源码仍可触发更新。
- 测试产物按进程、配置和 generation 隔离，基于源码、配置依赖和产物内容验证缓存，避免旧结果复用或覆盖在用产物；内容摘要去重重复通知，保留显式重建、构建中再编辑、合并更新、可等待关闭及过期缓存失败隔离。
