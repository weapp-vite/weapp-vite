---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `weapp-vite` 在共享 WXML/WXS 依赖与 WeChat DevTools 运行态下的两类稳定性问题。现在共享模板/脚本模块的 importer 传播和产物引用路径会更稳定，避免构建结果里出现错误的共享依赖落位，`wevu-runtime-e2e` 的 shared template/WXS HMR 场景也会在进入用例前主动恢复基线，避免中断后的脏状态把 `shared-hmr/helper.wxs` 之类的临时依赖残留到后续运行。与此同时，IDE 侧长链路 e2e 用例会在关键场景改用 fresh launch 与更明确的残留清理，减少 DevTools automator bridge 重启和页面 relaunch 失稳导致的误报。
