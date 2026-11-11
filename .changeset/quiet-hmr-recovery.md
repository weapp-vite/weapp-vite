---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(hmr): 恢复微信 WebView 安全脚本的状态保持 HMR，隔离旧构建与旧客户端的交付确认，并保留编译失败后的已发布基线。模板或样式无法可靠应用时自动切换 classic，支持后续编辑、源码恢复及配置重启；同步完整 HMR 验收入口和公开指引。
