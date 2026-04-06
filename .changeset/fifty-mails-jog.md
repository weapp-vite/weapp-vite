---
'weapp-vite': minor
'create-weapp-vite': patch
---

为 `weapp-vite dev` 增加终端快捷键能力，开发态启动后会在命令行里提示可用热键。现在支持按 `s` 直接截取当前小程序页面截图并保存到本地 `.tmp/weapp-vite-dev-screenshots` 目录，同时输出执行日志与结果路径；也支持按 `m` 开关开发态内置的 MCP `streamable-http` 服务，让调试阶段可以在同一终端里直接控制 MCP 会话，而不再依赖命令执行前的自动后台启动。
