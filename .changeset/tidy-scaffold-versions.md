---
"create-weapp-vite": patch
---

新增显式启用的 compatible 版本策略，从用户安装源选择兼容的最新稳定版本，并同步模板使用的 weapp-vite、wevu 和 dashboard 版本；查询失败时保留内置组合并提示实际版本。默认 bundled 策略跳过联网查询，同时补充镜像延迟和脚手架缓存的恢复步骤。
