---
"weapp-ide-cli": patch
"@weapp-vite/devtools-runtime": patch
"@weapp-vite/mcp": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

统一开发者工具安装选择，按安装绑定 HTTP 端口与自动化会话，防止不同版本误用登录宿主。新增进程级 CLI 路径选择及同机 E2E 租约，使多个工作区和宿主操作协作使用已登录的开发者工具，保留用户登录数据与其他项目连接。
