---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复微信状态保持 HMR 在空输出目录启动时遗漏 public 静态资源，导致 tabBar 图标缺失并阻止模拟器启动的问题。首轮完整发布显式遵循 Vite 已解析的 publicDir 与 copyPublicDir 配置，由 Vite 原生写入阶段复制资源；后续增量发布不重复覆盖 public 文件，兼容自定义静态目录、输出路径及禁用配置。
