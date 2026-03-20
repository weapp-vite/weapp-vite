---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复原生 layout script 在 Vue 打包收尾阶段错误发射 chunk 导致的构建失败问题。现在会在允许的构建钩子中预注册 layout 脚本 chunk，并保留 generateBundle 阶段只处理布局 sidecar 资源，同时补充对应的 transform、fallback 与 bundle 回归测试。
