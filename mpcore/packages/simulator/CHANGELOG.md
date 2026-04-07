# @mpcore/simulator

## 0.1.3

### Patch Changes

- 🐛 **继续补齐 `@mpcore/simulator` 的 loading 能力验证链路：为 `wx.showLoading` / `wx.hideLoading` 增加 demo、browser e2e 与 session/workbench 快照覆盖，让 Web 模拟器可以稳定观察 loading 显隐状态，并在类型测试中锁定对应 API 与快照契约。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 补齐 `wx.showShareMenu`、`wx.updateShareMenu`、`wx.hideShareMenu` 的 demo 与端到端验证链路。新增 component-lab fixture、headless 集成断言和 browser e2e 断言，确保 web 模拟器里的分享菜单状态快照可以被稳定触发、观察与回归验证。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `wx.getFileInfo` 能力，支持读取临时文件与保存文件的稳定文件大小和摘要信息，并兼容 `md5`、`sha1` 两种摘要算法。同步补齐 headless runtime、browser runtime、demo fixture、单元测试、browser e2e 与类型测试覆盖，保证文件摘要查询链路可以稳定验证。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

- 🐛 **补强了 `@mpcore/simulator` 对 `wx.createCanvasContext().drawImage(...)` 常见参数形态的覆盖，新增对 3 参数、5 参数与 9 参数调用形态的 headless runtime、browser runtime、类型契约与 Web demo 验证，方便在 Web 模拟器里稳定回归更接近微信小程序的图片绘制调用流程。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

- 🐛 **继续补齐 `@mpcore/simulator` 的 `wx.createCanvasContext` 路径能力，新增 `quadraticCurveTo`、`bezierCurveTo`、`arcTo`，并同步覆盖 headless runtime、browser runtime、类型契约与 Web demo 场景，方便在 Web 模拟器里验证更接近微信小程序的曲线路径调用流程。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `wx.saveImageToPhotosAlbum` 能力，用于消费 `canvasToTempFilePath` 产生的临时文件，并在文件缺失时返回与小程序风格一致的失败信息。同步补齐 headless runtime、browser runtime、demo fixture、单元测试、browser e2e 与类型测试覆盖，保证导出画布后的保存链路可验证。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `wx.createVideoContext`、`createIntersectionObserver`、`createMediaQueryObserver`、`wx.createAnimation` 与 `wx.createCanvasContext` 的基础能力，在 headless/runtime/browser 三层统一支持按页面或组件作用域定位目标节点，并补齐常见上下文方法、初始可见性/尺寸匹配计算、动画队列导出、Canvas 绘制命令快照与事件回调派发。同时修复组件实例选择器把后代组件误判为当前选择结果的问题，确保 `selectComponent` / `selectAllComponents` 在单段选择器与后代选择器场景下都更接近微信小程序行为。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

- 🐛 **继续补齐 `@mpcore/simulator` 的 `wx.createCanvasContext` 文本布局能力，新增 `setTextAlign` 与 `setTextBaseline`，并把最终文本对齐状态同步暴露到 canvas snapshot 中，方便在 headless runtime、browser runtime 与 Web demo 中验证更接近微信小程序的文本绘制配置。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

- 🐛 **继续补齐 `@mpcore/simulator` 的 canvas 导出链路，新增 `wx.canvasToTempFilePath` 支持：会把当前 canvas snapshot 导出到 headless 临时文件并返回 `tempFilePath`，同时覆盖 headless runtime、browser runtime、类型契约与 Web demo 场景，方便在 Web 模拟器里验证更接近微信小程序的绘制后导出流程。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

- 🐛 **修复 `@mpcore/simulator` 在直接调用组件方法后触发 `triggerEvent` 时复用旧交互目标的问题。现在 browser runtime、headless runtime 与 Web demo bridge 在无显式事件上下文的直接组件方法调用下，都会回落到组件宿主节点作为事件目标，避免把上一次内部节点交互的 `target` 泄漏到新的组件事件里。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `wx.chooseVideo` 能力，返回可预测的临时视频文件与基础元数据，并允许直接串联 `wx.saveVideoToPhotosAlbum` 做后续验证。同步补齐 headless runtime、browser runtime、demo fixture、单元测试、browser e2e 与类型测试覆盖，保证视频选择与保存链路可以稳定验证。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

- 🐛 **继续补齐 `@mpcore/simulator` 的 `wx.createCanvasContext` 路径填充规则能力，支持 `fill(rule)` 与 `clip(rule)` 透传 `evenodd` 等填充规则参数，并同步覆盖 headless runtime、browser runtime、类型契约与 Web demo 场景，方便在 Web 模拟器里验证更接近微信小程序的路径填充行为。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `wx.chooseMessageFile` 能力，支持按稳定顺序返回可预测的临时消息文件结果，并允许与 `wx.getImageInfo`、`wx.getVideoInfo` 串联验证图片与视频附件场景。同步补齐 headless runtime、browser runtime、demo fixture、单元测试、browser e2e 与类型测试覆盖，保证消息文件选择链路可以稳定验证。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 补齐了更多 `wx.createCanvasContext` 的路径与变换能力，包括 `arc`、`rect`、`closePath`、`save`、`restore`、`translate`、`rotate`、`scale`，并同步更新了 headless runtime、browser runtime、类型声明与 browser e2e 覆盖，方便在 Web 模拟器里还原更接近微信小程序的 canvas 交互流程。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `wx.setClipboardData` 与 `wx.getClipboardData` 能力，支持在 headless/browser runtime 中稳定读写剪贴板字符串，并把当前剪贴板内容暴露给 session/workbench 快照。同步补齐 demo fixture、单元测试、browser e2e 与类型测试覆盖，保证剪贴板交互链路可以稳定验证。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

- 🐛 **继续补齐 `@mpcore/simulator` 的 `wx.createCanvasContext` 线条样式能力，新增 `setLineCap`、`setLineJoin`、`setMiterLimit`，并把最终样式状态同步暴露到 canvas snapshot 中，方便在 headless runtime、browser runtime 和 Web demo 里验证更接近微信小程序的描边行为。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `wx.previewImage` 能力，并在 runtime 中暴露稳定的预览快照状态，便于 headless/browser 场景下验证当前预览图片与候选列表。同步补齐 demo fixture、单元测试、browser e2e 与类型测试覆盖，确保图片预览调用与调试桥快照保持一致。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `wx.startPullDownRefresh` 能力，直接复用现有下拉刷新事件流与停止状态跟踪，让页面可以主动触发 `onPullDownRefresh` 并维持稳定的 `active/stopCalls` 快照结果。同步补齐 headless runtime、browser runtime、demo fixture、单元测试、browser e2e 与类型测试覆盖，保证主动下拉刷新链路可以稳定验证。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

- 🐛 **继续补齐 `@mpcore/simulator` 的 `wx.createCanvasContext` 虚线状态观察能力，在 canvas snapshot 中新增 `lineDashOffset`，让 `setLineDash(pattern, offset)` 的偏移配置也能在 headless runtime、browser runtime 与 Web demo 中被稳定验证。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

- 🐛 **继续补齐 `@mpcore/simulator` 的 `wx.createCanvasContext` 绘制状态能力，新增 `clip`、`setGlobalAlpha`、`setLineDash`，并把最终透明度与虚线状态同步暴露到 canvas snapshot 中，方便在 headless runtime、browser runtime 与 Web demo 中验证更接近微信小程序的绘制流程。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

- 🐛 **继续补齐 `@mpcore/simulator` 的 `wx.createCanvasContext` 文本与阴影能力，新增 `strokeText` 与 `setShadow`，并把最终阴影状态同步暴露到 canvas snapshot 中，方便在 headless runtime、browser runtime 与 Web demo 中验证更接近微信小程序的文本绘制流程。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `wx.getVideoInfo` 能力，支持读取 `wx.chooseVideo` 与 `wx.chooseMedia` 生成的临时视频文件元数据，并返回稳定的时长、尺寸、码率、帧率与文件大小信息。同步补齐 headless runtime、browser runtime、demo fixture、单元测试、browser e2e 与类型测试覆盖，保证视频元数据读取链路可以稳定验证。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `wx.chooseImage` 能力，返回可预测的临时图片文件与 `tempFilePaths` / `tempFiles` 结果，并让生成的图片元数据能够被 `wx.getImageInfo` 继续读取。同步补齐 headless runtime、browser runtime、demo fixture、单元测试、browser e2e 与类型测试覆盖，保证图片选择与后续信息查询链路可稳定验证。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `wx.saveVideoToPhotosAlbum` 能力，允许基于 headless/browser runtime 中的临时文件完成视频保存调用，并在文件不存在时返回稳定的失败信息。同步补齐 demo fixture、单元测试、browser e2e 与类型测试覆盖，确保视频临时文件保存链路与图片保存能力保持一致。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `wx.chooseMedia` 能力，支持按稳定顺序返回图片与视频混合的临时媒体文件结果，并允许与 `wx.getImageInfo`、`wx.saveVideoToPhotosAlbum` 串联验证。同步补齐 headless runtime、browser runtime、demo fixture、单元测试、browser e2e 与类型测试覆盖，保证混合媒体选择链路可以稳定验证。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `wx.openDocument` 能力，支持校验临时文件与保存文件是否存在、推断或接收文档类型，并把最后一次打开的文档状态稳定暴露给 session/workbench 快照。同步补齐 headless runtime、browser runtime、demo fixture、单元测试、browser e2e 与类型测试覆盖，保证文档打开链路可以稳定验证。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `wx.compressImage` 能力，支持基于已有临时图片文件生成新的压缩结果文件，并让压缩后的输出继续被 `wx.getImageInfo` 读取元数据。同步补齐 headless runtime、browser runtime、demo fixture、单元测试、browser e2e 与类型测试覆盖，保证图片选择、压缩与信息读取链路可以稳定验证。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `wx.getImageInfo` 能力，支持读取 `canvasToTempFilePath` 导出的临时图片元数据，并在普通文件场景下回退到基于路径扩展名的图片类型推断。同步补齐 headless runtime、browser runtime、demo fixture、单元测试、browser e2e 与类型测试覆盖，保证图片信息查询与导出链路可稳定验证。** [#403](https://github.com/weapp-vite/weapp-vite/pull/403) by @sonofmagic

## 0.1.2

### Patch Changes

- 🐛 **增强 `@mpcore/simulator` 的选择器相关行为。现在 headless runtime 与 browser runtime 都支持根据当前渲染树处理 `wx.pageScrollTo({ selector })`，`createSelectorQuery` 可匹配 `tag/id/class/data-*` 组合形式的简单复合选择器，页面/组件实例上的 `selectComponent` 与 `selectAllComponents` 也支持同类复合选择器与后代组件选择器，testing bridge 也补齐了这些查询链路的显式覆盖以及缺失场景下的超时/空结果边界验证。与此同时补充对应单测、browser e2e 断言，以及 `mpcore/demos/web` 中 `commerce-shell` 与 `component-lab` 场景的验证入口。** [#397](https://github.com/weapp-vite/weapp-vite/pull/397) by @sonofmagic

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
