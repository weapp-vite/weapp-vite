---
"@weapp-vite/ast": patch
"@weapp-vite/dashboard": patch
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

通过 GitHub Actions 可信发布重新发布脚手架及配套核心包，恢复 trusted publisher 与来源证明元数据，使启用 pnpm `trustPolicy=no-downgrade` 的用户可继续安装国内网络容错修复版本；保留随包依赖组合、代理与镜像支持及 Wevu CSS 变量辅助函数修复。
