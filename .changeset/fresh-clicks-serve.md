---
'@wevu/compiler': patch
'create-weapp-vite': patch
---

修复 Vue SFC 中组件节点 `@click` 被错误编译成原生 `tap` 的问题，保留组件自定义 `click` 事件，恢复零售模板中 TDesign 与业务组件的点击交互链路。
