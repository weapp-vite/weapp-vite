---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复仅声明在 `devDependencies` 中的小程序组件包被误判为本地组件的问题。组件入口与 npm 构建复用同一候选规则，正确识别小程序包和显式配置的依赖，并保留普通开发工具、本地组件及 `legacy` 策略的分类边界。
