# @mpcore/simulator

## 0.1.1

### Patch Changes

- 🐛 **修复 headless 文件系统在已保存文件之间重命名覆盖时错误继承源文件 `createTime` 的问题，确保覆盖后保留目标文件的创建时间。** [`87d46af`](https://github.com/weapp-vite/weapp-vite/commit/87d46af684229aa5e79edb5ed89fdd343279541d) by @sonofmagic

## 0.1.0

### Minor Changes

- ✨ **为 `@mpcore/simulator` 增加了 `wx.downloadFile`、`wx.saveFile`、`wx.uploadFile` 的 headless/browser 模拟能力，并补充对应的文件快照、mock 日志与类型覆盖。同时修复 browser e2e Vitest 配置，使其与 `mpcore/demos/web` 一致注册 Tailwind Vite 插件，保证测试环境能够正确处理 Tailwind v4 样式入口。** [#367](https://github.com/weapp-vite/weapp-vite/pull/367) by @sonofmagic

## 0.0.3

### Patch Changes

- 🐛 **为 `@mpcore/simulator` 的页面事件补充可观测的下拉刷新状态，使 `wx.stopPullDownRefresh()` 在 headless runtime 与 browser runtime 中都能被稳定验证。** [`6bc8273`](https://github.com/weapp-vite/weapp-vite/commit/6bc82739a083333a08389e49e7ae4052b3aeb8ac) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 的 testing bridge 页面句柄补充组件定位与等待能力，使页面级测试可以直接等待组件出现并获取对应组件句柄，而无需回到会话级接口。** [`4c3c23e`](https://github.com/weapp-vite/weapp-vite/commit/4c3c23e8ff133fc3135f101bfbb9fcd1f8815f67) by @sonofmagic

- 🐛 **完善 `@mpcore/simulator` 的 headless runtime 能力，新增 `wx.createSelectorQuery`，并为文件系统运行时补齐自定义组件渲染、组件实例选择与测试桥接支持，使更多小程序页面和组件场景可以直接在模拟器中运行与断言。** [`540be9b`](https://github.com/weapp-vite/weapp-vite/commit/540be9bcde9120bb9171e1f19db33a8928eab53b) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 的 testing bridge 节点句柄补充到作用域句柄的桥接能力，使测试可以从节点直接获取所属作用域并继续进行组件级调试。** [`f2b2bf3`](https://github.com/weapp-vite/weapp-vite/commit/f2b2bf30aeb35a9f1cb887564e3956fb77ce46d7) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 的 testing bridge 补充等待式组件定位能力，使 headless 测试可以直接等待异步出现的组件与组件列表，无需手工轮询页面渲染结果。** [`f1180ee`](https://github.com/weapp-vite/weapp-vite/commit/f1180eed3e38bea6ecb5d9726cb3f9552eb6bcc6) by @sonofmagic

- 🐛 **补充 `@mpcore/simulator` 中组件作用域的选择器查询支持，使 `wx.createSelectorQuery().in(component)` 能在 headless runtime 与 browser runtime 中按组件根作用域执行节点查询。** [`fb60bb5`](https://github.com/weapp-vite/weapp-vite/commit/fb60bb5758cce10f8d9f05d0f640f0e2998abe02) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 的 testing bridge 节点句柄补充页面句柄桥接能力，使测试可以从任意节点直接回到当前页面上下文继续读取页面数据。** [`77deafd`](https://github.com/weapp-vite/weapp-vite/commit/77deafdc6637f8563f0c56afb9a4fe0129b54ff0) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 的 testing bridge 组件句柄补充等待式组件定位能力，使嵌套组件测试可以直接在组件作用域中等待子组件出现并继续调试。** [`220debd`](https://github.com/weapp-vite/weapp-vite/commit/220debd1543f1da269b72967f38fc98818f3d094) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 的 testing bridge 组件句柄补充父组件等待能力，使嵌套组件测试可以在组件作用域中直接等待宿主组件可用后继续断言。** [`f961982`](https://github.com/weapp-vite/weapp-vite/commit/f96198270198e754b13f3bde10a74b658516c602) by @sonofmagic

- 🐛 **完善 `@mpcore/simulator` 中组件事件对象的对齐行为，使 testing bridge 命中组件内部节点后，冒泡到页面的事件可以保留更准确的 `target`、`currentTarget` 与 `mark` 信息。** [`fa855da`](https://github.com/weapp-vite/weapp-vite/commit/fa855daee0061eb1581a40c34d02719a93ea11ce) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 的 testing bridge 增加组件句柄定位能力，使 headless 测试可以直接按选择器获取组件作用域句柄并读取快照，减少对内部渲染标记的依赖。** [`410bb1a`](https://github.com/weapp-vite/weapp-vite/commit/410bb1a8332cc1bc8c4bea714103422db621bf39) by @sonofmagic

- 🐛 **补充 `@mpcore/simulator` 的选择器查询回归覆盖，验证 `selectAll(...).fields(...)` 在页面与组件作用域下都能稳定返回数组结果，减少后续选择器行为回退风险。** [`6ce4cf6`](https://github.com/weapp-vite/weapp-vite/commit/6ce4cf67a5dfb950ceb57e20077aee9626717eca) by @sonofmagic

- 🐛 **完善 `@mpcore/simulator` 的选择器查询结果形状，支持从节点属性中解析 `mark`，并为 `context` 与 `node` 字段返回可辨识的占位结果，便于测试中区分未实现能力与缺失节点。** [`1c61128`](https://github.com/weapp-vite/weapp-vite/commit/1c61128471a03604effe932eedeaf3e48f68ea04) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 的 testing bridge 节点句柄补充页面作用域与组件作用域的显式区分能力，便于从节点直接切换到正确的调试上下文。** [`2f2d79d`](https://github.com/weapp-vite/weapp-vite/commit/2f2d79d23ee7d27f29e7d7b3c98189859cc93163) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 的 testing bridge 补充作用域快照读取能力，使 headless 测试可以直接通过会话句柄查看组件作用域状态，而不必依赖页面外部断言路径。** [`fd49af8`](https://github.com/weapp-vite/weapp-vite/commit/fd49af886c95a22a98c3ff6ebafbde4b8ed6d62d) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 的 testing bridge 组件句柄补充直接方法调用能力，使测试可以不经过节点事件分发，直接驱动组件实例方法并观察页面与组件状态变化。** [`c4fe66e`](https://github.com/weapp-vite/weapp-vite/commit/c4fe66e079760091cf0fa0942b380b3425d53650) by @sonofmagic

- 🐛 **补充 `@mpcore/simulator` 中文件系统 headless runtime 的组件生命周期覆盖，确保自定义组件的 `lifetimes` 与 `pageLifetimes` 在运行时和回归测试中都有明确验证。** [`0ee9669`](https://github.com/weapp-vite/weapp-vite/commit/0ee96698f7ed6ae9ce4a7d5b6508c06305b5919f) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 的 testing bridge 组件句柄补充嵌套组件选择能力，使 headless 测试可以从父组件句柄继续定位子组件并读取子组件作用域快照。** [`a602ff0`](https://github.com/weapp-vite/weapp-vite/commit/a602ff06c674a988823a270c3268b8616aa09e6b) by @sonofmagic

- 🐛 **增强 `@mpcore/simulator` 的 testing bridge 组件表单事件支持，使组件内部节点上的 `input`、`change` 与 `blur` 事件可以在 headless 测试中正确驱动组件实例状态更新。** [`4aa66c6`](https://github.com/weapp-vite/weapp-vite/commit/4aa66c645cec231365709990b4afb28462deac4e) by @sonofmagic

- 🐛 **增强 `@mpcore/simulator` 的 testing bridge 组件事件分发能力，使测试中命中的组件内部节点可以按作用域调用对应组件实例方法，并正确回流到页面事件断言。** [`37d0856`](https://github.com/weapp-vite/weapp-vite/commit/37d0856aafc582699d437664f131c33cb47a60d5) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 的 testing bridge 组件句柄补充页面句柄桥接能力，使测试可以从组件上下文直接回到当前页面并继续读取页面数据。** [`f771374`](https://github.com/weapp-vite/weapp-vite/commit/f77137473effc562be77258fd9686379e80fad44) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 的 testing bridge 组件句柄补充页面作用域桥接能力，使测试可以从组件上下文直接切换到页面作用域并读取页面级快照。** [`2a19ebd`](https://github.com/weapp-vite/weapp-vite/commit/2a19ebd0ad73d5615107607f86954f8f4f12db0b) by @sonofmagic

- 🐛 **重构 `@mpcore/simulator` 的测试结构：将浏览器 e2e 用例独立到 `e2e/` 目录，并新增 `test-d/` + `tsd` 类型验证机制。现在该包具备清晰的单元/集成、浏览器 e2e 与类型契约三层测试入口。** [`406fce2`](https://github.com/weapp-vite/weapp-vite/commit/406fce2b80b8cf969a2c326a438d749d3a9dde95) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 的文件系统 headless runtime 补充组件作用域快照能力，便于在运行时直接检查组件的 `data`、`properties` 与方法暴露情况。** [`abb8481`](https://github.com/weapp-vite/weapp-vite/commit/abb8481f845c6a0f578b54e1c86ce7470c8498f4) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 的 testing bridge 节点句柄补充父组件作用域桥接能力，使嵌套组件内部节点可以直接回到宿主组件上下文继续调试。** [`06bd1d9`](https://github.com/weapp-vite/weapp-vite/commit/06bd1d996afd06418a6365d8f540ac739e63fb56) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 的 testing bridge 组件句柄补充父组件定位能力，使嵌套组件测试可以直接从子组件句柄回溯到其宿主组件并读取宿主作用域快照。** [`8afa5d9`](https://github.com/weapp-vite/weapp-vite/commit/8afa5d9d617c7a8ec80edf16046f59938fa583fb) by @sonofmagic

- 🐛 **修复 `@mpcore/simulator` 在真实浏览器环境中的兼容性问题，并新增浏览器 e2e 测试基线。现在 web demo 会暴露稳定的 e2e 调试桥，且 `test:e2e` 可在真实浏览器中验证场景加载、路由跳转、请求、存储与页面事件等核心能力。** [`2a16fe6`](https://github.com/weapp-vite/weapp-vite/commit/2a16fe64acb1ecc95fedc6d42c5636cfe40d2895) by @sonofmagic

## 0.0.2

### Patch Changes

- 🐛 **为宿主 `wx` 对象补充异步 storage API，包括 `setStorage/getStorage/removeStorage/clearStorage`。** [`6e0b129`](https://github.com/weapp-vite/weapp-vite/commit/6e0b12939ec90d52a9bcefa01f0c1eb1834a945b) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `setBackgroundTextStyle` 宿主能力，支持页面默认背景文本样式继承、运行时更新以及非法参数失败分支，并暴露 session 级背景样式断言。** [`dcaf280`](https://github.com/weapp-vite/weapp-vite/commit/dcaf280dc1dccb7fd6b2063c91656314e38aff68) by @sonofmagic

- 🐛 **为 headless testing 页面句柄补充 `waitForTextGone()`，方便对异步消失内容做断言与等待。** [`6d98869`](https://github.com/weapp-vite/weapp-vite/commit/6d988699a3342ccca30dc3b2c3ae7fb8603036de) by @sonofmagic

- 🐛 **为宿主 `wx` 对象补充 `showLoading/hideLoading`，并增加 loading 状态快照能力。** [`eda3ae8`](https://github.com/weapp-vite/weapp-vite/commit/eda3ae80f895aa0a63847580664783c4b03cc2cb) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `setBackgroundColor` 宿主能力，支持页面默认背景颜色继承、运行时更新，并将背景颜色与文本样式统一暴露为 session 级页面背景快照。** [`006c677`](https://github.com/weapp-vite/weapp-vite/commit/006c6774bbec118d562af58932fc8207a727d1cf) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 tabBar item 状态宿主能力，支持 red dot 与 badge 的显示、隐藏、更新，并暴露 session 级 tabBar snapshot 用于 runtime/browser 断言。** [`3c71135`](https://github.com/weapp-vite/weapp-vite/commit/3c711351d759ca6d3eba51d0c6984c8316a3cedf) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `wx.setNavigationBarTitle` 宿主能力，支持页面默认导航栏标题初始化、运行时更新以及 session 级标题断言。** [`8ea2f56`](https://github.com/weapp-vite/weapp-vite/commit/8ea2f5619be60c119b9ca5679d670971309dd018) by @sonofmagic

- 🐛 **为宿主 `wx` 对象补充 `getStorageInfoSync/getStorageInfo`，支持读取 storage keys 与容量信息。** [`df99cf6`](https://github.com/weapp-vite/weapp-vite/commit/df99cf633daf33bd8e1be39237a77638ed0e08d4) by @sonofmagic

- 🐛 **为 headless 与 browser runtime 补充 `wx.nextTick` 宿主能力，并增加对应时序回归测试。** [`d94f3e4`](https://github.com/weapp-vite/weapp-vite/commit/d94f3e44c0cf2c4538e49afea592d0eb15f110de) by @sonofmagic

- 🐛 **为宿主 `wx` 对象补充 `getSystemInfoSync/getSystemInfo`，并让结果跟随 `triggerResize()` 更新。** [`ff5b79c`](https://github.com/weapp-vite/weapp-vite/commit/ff5b79cfa3bf5c746db569aab9d6710c0e44e39c) by @sonofmagic

- 🐛 **为 headless testing 节点句柄补充 `tap()` 交互能力，并修复相关类型定义，使测试桥可以直接从渲染节点触发事件并稳定读取 `dataset`。** [`052914b`](https://github.com/weapp-vite/weapp-vite/commit/052914bc3fb6cd7fdf3eccd4befb156690ad42f6) by @sonofmagic

- 🐛 **为宿主 `wx` 对象补充 `getWindowInfo/getAppBaseInfo/canIUse`，并让窗口信息跟随 `triggerResize()` 更新。** [`7f9c289`](https://github.com/weapp-vite/weapp-vite/commit/7f9c289dcf5e322d57a9dfe0367af802659ce2fc) by @sonofmagic

- 🐛 **为 headless testing 页面句柄补充 `waitForData()`，支持对异步 `setData` 结果进行值匹配与谓词等待。** [`f1827dd`](https://github.com/weapp-vite/weapp-vite/commit/f1827dde8691339632db90f852cb792bdefd3748) by @sonofmagic

- 🐛 **为宿主 `wx` 对象补充 `getLaunchOptionsSync/getEnterOptionsSync`，并与现有冷启动入口信息保持一致。** [`b08c1f4`](https://github.com/weapp-vite/weapp-vite/commit/b08c1f42abab22f202bb8f2d15a25083a16349a2) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `getNetworkType` 与 `on/offNetworkStatusChange` 宿主能力，并允许通过 session 在 headless/browser 测试里切换网络状态。** [`84997c1`](https://github.com/weapp-vite/weapp-vite/commit/84997c1a90fc4225d33c2a0abd8dd3d0046d2658) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加分享菜单宿主能力，支持 `showShareMenu/updateShareMenu/hideShareMenu` 状态切换，并暴露 session 级分享菜单快照用于 runtime/browser 断言。** [`7175e14`](https://github.com/weapp-vite/weapp-vite/commit/7175e147897655a8e35af71295ae34cdcb5b7889) by @sonofmagic

- 🐛 **为 headless testing 节点句柄补充 `input()`、`change()`、`blur()` 等表单交互辅助方法，简化对输入类事件的测试驱动。** [`ef888b4`](https://github.com/weapp-vite/weapp-vite/commit/ef888b44d8bc57ec2e61b21e5433cd4d12ab9d53) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加导航栏颜色与 loading 宿主能力，支持页面默认导航栏配置继承、运行时更新，以及 session 级导航栏状态断言。** [`717d067`](https://github.com/weapp-vite/weapp-vite/commit/717d067dc1575524c4fbd3bbbfb50e117be722e2) by @sonofmagic

- 🐛 **为 headless testing 节点句柄补充通用 `trigger(eventName)` 事件触发能力，支持在渲染节点上直接驱动 `input` 等绑定事件。** [`ce60645`](https://github.com/weapp-vite/weapp-vite/commit/ce6064557d3cbe30d21b61cc8fb8de5c78e587fd) by @sonofmagic

- 🐛 **为 headless testing 会话句柄补充 `waitForCurrentPage()`，支持对异步导航结果进行轮询等待。** [`d903ba3`](https://github.com/weapp-vite/weapp-vite/commit/d903ba30ae93f457604b78a12bfbd6d141df5b4f) by @sonofmagic

- 🐛 **增强 `wx.request` mock，支持延迟响应与 `RequestTask.abort()` 语义。** [`0438161`](https://github.com/weapp-vite/weapp-vite/commit/0438161f3d83c1384a5b475eaf93910a44796065) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `wx.showActionSheet` 宿主能力，支持默认选中第一项、按次 mock 取消或指定选项，并暴露 action sheet 调用日志用于 runtime/browser 断言。** [`531a2c7`](https://github.com/weapp-vite/weapp-vite/commit/531a2c725b79326946c267273779af3144840a2d) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `wx.showModal` 宿主能力，支持默认确认返回、按次 mock 弹窗结果，并暴露 modal 调用日志用于 runtime/browser 断言。** [`7fc105c`](https://github.com/weapp-vite/weapp-vite/commit/7fc105c2bba77c2ed3817468a8bf53f91416183e) by @sonofmagic

- 🐛 **为宿主 `wx` 对象补充 `getMenuButtonBoundingClientRect()`，并让结果基于当前窗口尺寸派生。** [`f4e396b`](https://github.com/weapp-vite/weapp-vite/commit/f4e396b5df5cbee66f6d08b3abed80526dd7ded4) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `showTabBar/hideTabBar` 宿主能力，并暴露 session 级 tabBar 可见状态用于 runtime/browser 断言。** [`c83a184`](https://github.com/weapp-vite/weapp-vite/commit/c83a184d6e161b915212aa62fd47ed83676e47be) by @sonofmagic

- 🐛 **为 headless testing 页面句柄补充 `waitForSelector()` 与 `waitForText()`，简化对异步渲染内容的轮询等待。** [`d2d6aa7`](https://github.com/weapp-vite/weapp-vite/commit/d2d6aa7bb25a7c788a2db89c51f43c90b8ca4fb4) by @sonofmagic

## 0.0.1

### Patch Changes

- 🐛 **补齐 simulator 与微信开发者工具在页面导航、生命周期、页面事件与应用启动参数上的关键行为对齐，并为这些运行时语义补充稳定的测试覆盖。** [#355](https://github.com/weapp-vite/weapp-vite/pull/355) by @sonofmagic

- 🐛 **增强 `@mpcore/simulator` 的宿主能力与浏览器控制台体验：补齐 `triggerEvent` 在组件宿主链上的冒泡/截断行为，新增 `showToast`、`setStorageSync/getStorageSync` 与基于内存路由表的 `wx.request` mock 通道，并让 web demo 的代码面板统一使用 Shiki 高亮展示。** [#355](https://github.com/weapp-vite/weapp-vite/pull/355) by @sonofmagic

- 🐛 **补齐浏览器模拟器对高频 WXML 结构指令与交互细节的支持，新增 `wx:if` / `wx:elif` / `wx:else`、`wx:for`、`catchtap` 等能力，并修正组件属性在循环场景下的同步更新与 demo 预览点击解析。** [#355](https://github.com/weapp-vite/weapp-vite/pull/355) by @sonofmagic
