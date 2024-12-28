---
"weapp-vite": major
---

feat: release `2.0.0`

# Breaking Changes

- 现在添加了静态的 `wxml` 分析引擎，会自动分析所有引入的组件，页面, `<import/>`,  `<include/>` 标签等等，所以现在不会默认复制所有的 `wxml` 文件到 `dist` 目录下，只会复制 `wxml` 文件中用到的组件，页面，以及 `<import/>` ， `<include/>` 标签引入的组件等等。
