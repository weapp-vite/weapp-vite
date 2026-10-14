---
"weapp-vite": patch
"@wevu/compiler": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 补齐构建插件所属包的 Babel core 与 MCP server 宿主依赖，修复关闭自动 peer 安装和依赖提升时的严格消费者安装失败，并以真实发布包验证 TypeScript/CommonJS、Vue JSX 转换及 MCP Node adapter 加载。
