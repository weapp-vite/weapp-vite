---
"create-weapp-vite": patch
---

fix(create-weapp-vite): 固定模板中的 ESLint 和 Stylelint 配置依赖到已验证版本，避免补丁版本提高 Node 要求或依赖尚未发布完整，导致新建项目安装失败。
