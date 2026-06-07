---
"@weapp-core/init": patch
"create-weapp-vite": patch
"weapp-ide-cli": patch
"weapp-vite": patch
---

升级模板与初始化流程中的 weapp-tailwindcss 默认版本，并增强 weapp-ide-cli 在截图、审计和当前页面查询场景下的目录创建与超时提示，降低残留 DevTools 会话导致 IDE 自动化任务卡住时的排查成本。
