---
'@weapp-vite/miniprogram-automator': patch
'@weapp-vite/web': patch
'@wevu/compiler': patch
'create-weapp-vite': patch
'rolldown-require': patch
'weapp-vite': patch
---

自动补充依赖升级发布记录。
涉及包：
- @weapp-vite/web：dependencies.postcss-selector-parser、dependencies.rolldown
- @wevu/compiler：dependencies.postcss-selector-parser
- @weapp-vite/miniprogram-automator：dependencies.ws
- rolldown-require：peerDependencies.rolldown
- weapp-vite：dependencies.rolldown
- create-weapp-vite：基于 weapp-vite / wevu 的依赖升级联动更新脚手架模板
