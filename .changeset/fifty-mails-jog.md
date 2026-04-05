---
'weapp-vite': minor
'create-weapp-vite': patch
---

为 `weapp-vite dev` 增加终端快捷键能力，开发态启动后会在命令行里提示可用热键。首个内置动作是按 `s` 直接截取当前小程序页面截图并保存到本地 `.tmp/weapp-vite-dev-screenshots` 目录，同时输出执行日志与结果路径，方便在调试过程中快速采集页面快照，后续也可在同一入口继续扩展更多开发动作。
