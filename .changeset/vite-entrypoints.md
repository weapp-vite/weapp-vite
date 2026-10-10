---
'@mpcore/simulator': minor
'create-weapp-vite': patch
'weapp-vite': minor
---

feat(vite): 提供 `weapp-vite/vite` 标准插件，使独立 `wv`、普通 Vite 和 Vite+ 共用小程序编译能力与宿主生命周期。

- 支持微信原生、Wevu Vue 与 React 构建，开放实验性 classic 和微信 stateful 开发模式；纯 Web 目标复用宿主原生流程，不额外加载小程序引擎或第二份配置。
- 对齐六平台单目标原生与 Vue 构建、classic 开发及生产 watch；支持微信独立分包、插件双产物、worker 和组件库。子构建复用已加载配置与用户插件；stateful 仍为微信实验能力，Web/小程序混合宿主不开放。
- `vite build --watch` / `vp build --watch` 保留完整产物，支持页面与分包增删、依赖更新、错误恢复及写出后关闭。组件库支持原生/Vue 组件、入口重命名、内存构建和声明文件发布。
- 独立 CLI 与标准插件共用隔离编译会话及路由宏上下文，stateful 快照复用本轮配置。关闭或构建失败会等待配置、编译、npm、worker 及替换会话结束并释放自有资源，保留原始错误。
- mpcore worker 补齐消息通信、独立模块缓存和终止能力，保持 Node、浏览器及小程序场景一致。
