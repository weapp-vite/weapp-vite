---
'@weapp-core/shared': patch
'@wevu/api': patch
'@wevu/compiler': patch
'create-weapp-vite': patch
'weapp-vite': patch
'wevu': patch
---

收敛多小程序平台的基础平台模型，在 `@weapp-core/shared` 中新增统一平台 registry，并让 `weapp-vite`、`@wevu/compiler`、`wevu`、`@wevu/api` 共享同一份平台描述、模板预设、runtime 全局对象与页面身份 key 解析逻辑。后续新增 `swan`、`jd`、`xhs` 等平台时，可以更稳定地通过补 descriptor / matrix 扩展，而不必继续在核心包中散落平台分支。
