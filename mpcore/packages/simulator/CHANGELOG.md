# @mpcore/simulator

## 0.0.1

### Patch Changes

- 🐛 **补齐 simulator 与微信开发者工具在页面导航、生命周期、页面事件与应用启动参数上的关键行为对齐，并为这些运行时语义补充稳定的测试覆盖。** [#355](https://github.com/weapp-vite/weapp-vite/pull/355) by @sonofmagic

- 🐛 **增强 `@mpcore/simulator` 的宿主能力与浏览器控制台体验：补齐 `triggerEvent` 在组件宿主链上的冒泡/截断行为，新增 `showToast`、`setStorageSync/getStorageSync` 与基于内存路由表的 `wx.request` mock 通道，并让 web demo 的代码面板统一使用 Shiki 高亮展示。** [#355](https://github.com/weapp-vite/weapp-vite/pull/355) by @sonofmagic

- 🐛 **补齐浏览器模拟器对高频 WXML 结构指令与交互细节的支持，新增 `wx:if` / `wx:elif` / `wx:else`、`wx:for`、`catchtap` 等能力，并修正组件属性在循环场景下的同步更新与 demo 预览点击解析。** [#355](https://github.com/weapp-vite/weapp-vite/pull/355) by @sonofmagic
