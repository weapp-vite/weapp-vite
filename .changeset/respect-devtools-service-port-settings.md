---
'weapp-ide-cli': patch
'weapp-vite': patch
'create-weapp-vite': patch
---

改进微信开发者工具服务端口处理逻辑：启动前会检测并沿用用户当前的服务端口配置，不再覆盖已有设置；当检测到用户关闭服务端口时，会保留原配置并回退到普通打开流程，同时继续按需写入项目信任信息。
