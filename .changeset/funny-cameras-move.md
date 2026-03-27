---
'create-weapp-vite': patch
---

修复通过 npm registry 安装并执行 `pnpm create weapp-vite` 时模板文件被错误过滤的问题。脚手架现在会基于模板目录内的相对路径判断是否跳过文件，不再把安装路径中的 `node_modules/create-weapp-vite` 误判为模板内部的 `node_modules`，从而确保各模板都能完整创建出源码、配置和静态资源文件。
