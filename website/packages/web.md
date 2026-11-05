---
title: "@weapp-vite/web"
description: "@weapp-vite/web 是实验性的 H5 运行时与 Vite 插件，用于把小程序模板能力映射到浏览器环境做验证。"
keywords:
  - Weapp-vite
  - 运行时
  - packages
  - web
  - "@weapp-vite/web"
  - 是实验性的
  - browser
  - 运行时与
---

# @weapp-vite/web

`@weapp-vite/web` 是实验性的 H5 运行时与 Vite 插件，用于把小程序模板能力映射到浏览器环境做验证。

编译器和浏览器字符串模板入口复用 [`@weapp-vite/wxml`](/packages/wxml) 的解析核心。`web` 决定输出目标，输入模板的方言单独选择；WXML 输入仍按小程序语法读取。组件映射、空白处理、表达式求值和渲染后 DOM 输出继续由 Web 层负责，现有 `renderTemplate(ChildNode[])` 接口保持兼容。

输入扩展名和脚本配方来自 `@weapp-vite/wxml/presets`，编译器与浏览器绑定同一 `/core` 解析器。未明确输入平台的历史 XML 默认行为继续保留；显式 WXML 输入使用微信方言。

这次平台解耦接入属于尚未发布的主线实现，正式性能仍未验收。当前检查点与失败原始证据见[模板平台解耦报告](https://github.com/weapp-vite/weapp-vite/blob/main/docs/reports/2026-11-05-template-decoupling/README.md)；既有 Web 功能验证与新核心的最终回归结论分开记录。

> 当前仍是 POC 阶段，适合技术验证，不建议直接作为生产方案。

## 何时使用

- 你要在浏览器快速验证小程序页面逻辑
- 你要做模板编译、事件桥接、路由行为的实验
- 你要为小程序 DSL 做 Web 演示或调试

## 安装

```bash
pnpm add -D @weapp-vite/web
```

## 在 weapp-vite 项目中运行

项目根目录提供 `index.html` 后，可直接让 CLI 从原有 `app.json`、WXML/WXSS/TS 或 Vue SFC 源码生成 Web 入口，无需维护第二套路由：

```json
{
  "scripts": {
    "dev:web": "wv dev -p web --host",
    "build:web": "wv build -p web"
  }
}
```

`web` 是规范平台名，`h5` 仅作为向后兼容别名保留。App 模块会先于页面和组件求值，确保 App 注册、`defineAppSetup()`、router 和 `onLaunch` 在首个页面挂载前就绪。仓库通过 44 个 `e2e-apps/*` / `templates/*` 项目的生产构建与 Playwright 启动矩阵持续验证该入口。

Wevu 会根据 `web` 目标[自动裁剪平台适配与未使用能力](/wevu/runtime#按平台与使用能力裁剪)。Web 仍保留 App/Component、页面栈和宿主桥接；其体积不能直接作为 Vue DOM runtime 或原生 App 渲染器的体积基线。

## glass-easel 组件后端实验

仓库中的 `@weapp-vite/glass-easel-web-adapter` 提供独立的官方组件树实验：支持显式注册父子组件、默认与命名 slot、属性和 observer、数据更新、事件及递归卸载。示例与限制见 [adapter README](https://github.com/weapp-vite/weapp-vite/tree/main/packages-runtime/glass-easel-web-adapter)。

该入口需要业务宿主显式创建 adapter，尚未接入上述 CLI 的默认 runtime，也没有新增 renderer 配置。模板编译仍在浏览器注册阶段执行，`ready`、原生组件、样式、路由与 API 需要后续宿主集成；文档级官方事件委托由共享 backend 持有。本阶段用于组件语义验证，不能据此认定真机或多平台兼容已完成。

## Vite 插件接入

```ts
import { weappWebPlugin } from '@weapp-vite/web'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    weappWebPlugin({
      srcDir: 'src',
      runtime: {
        executionMode: 'compat',
        viewport: {
          mode: 'mini-program',
          maxWidth: 375,
          desktopBreakpoint: 600,
        },
        routing: {
          mode: 'history',
          base: '/mini',
        },
        seo: {
          defaultTitle: '商城',
          titleTemplate: '%s | Web Demo',
          description: '小程序页面的 Web 运行时演示。',
        },
        resourceHints: {
          links: [{ rel: 'preconnect', href: 'https://cdn.example.com' }],
        },
      },
    }),
  ],
})
```

### 模板输入方言

`templateInput` 描述输入模板的来源与编码，独立于 Web 输出目标。原生模板入口和它们的原生 include/import 依赖默认按各自文件后缀选择：

| 输入 | 默认规则 |
| --- | --- |
| `.wxml` | 微信 / `legacy` |
| `.axml`、`.ttml`、`.swan`、`.jxml`、`.xhsml` | 对应平台 / `xml` |
| 历史 `.qml`、`.ksml` | QQ、快手 / `xml` |
| `.html` | `xml` |
| 无已知后缀的依赖 | 继承父模板输入规则 |

显式 `syntax` 优先。需要读取使用 XML 编码的原生 WXML 时，可配置：

```ts
weappWebPlugin({
  templateInput: {
    platform: 'weapp',
    syntax: 'xml',
  },
})
```

`templateInput.platform` 支持六个构建平台以及历史 QQ、快手入口；`rawTags?: readonly string[]` 可替换完整原始脚本标签列表。默认按实际输入平台选择脚本标签，并包含 `script`，因此微信或 SVG 的普通 `<filter>` 子树仍参与编译。该选项在 weapp-vite 配置中位于 `weapp.web.pluginOptions.templateInput`，详见 [Web 配置](/config/web#模板输入规则)。

识别原始脚本边界不代表执行该平台的脚本语言。当前 Web 脚本收集和执行入口仍只处理 `wxs`，`sjs`、`filter` 等平台脚本的执行能力需由对应消费者另行提供。

Vue SFC 降低后的模板（含 `<template src>`）固定使用微信 / XML 编码。即使同一 `.wxml` 文件同时作为 SFC 外部模板和原生模板入口，两条路径也分别使用各自输入规则；SFC 路径保留 XML 反斜杠，原生路径默认按 legacy 解码。原生 include/import 依赖继续按自身后缀及显式插件配置选择。

直接调用编译器内部的 `parseWxml(source)` 保留历史 XML 默认；显式传入 `{ platform: 'weapp' }` 时采用 legacy，显式 `syntax` 仍优先。

### 字符串模板

`createTemplate(source, options?)` 使用相同输入选项，省略时默认微信 / legacy：

```ts
import { createTemplate } from '@weapp-vite/web/runtime'

const render = createTemplate('<view>{{ message }}</view>', {
  platform: 'weapp',
  syntax: 'xml',
})
const output = render({ message: 'hello' })
```

`TemplateInputOptions` 从包主入口、`/runtime` 和 `/runtime/polyfill` 导出。已有 `renderTemplate(nodes: ChildNode[], scope?)` 继续接收 domhandler 形状的节点。

结束边界确定的完整插值即使表达式内部有误，仍遵循现有 safe / compat / strict 执行策略；缺少 `}}`、标签破损或字符串等边界无法确定时，编译器和 `createTemplate` 会明确拒绝输入。独立低层 `interpolateText` 的历史容错行为不作为完整模板的结构恢复规则。

## 运行时能力

包内同时导出运行时 API，例如：

- `defineComponent`
- `registerApp` / `registerPage` / `registerComponent`
- `navigateTo` / `navigateBack` / `getCurrentPages`
- `request` / `showToast` 等 polyfill API

`createInnerAudioContext()` 基于独立的 `HTMLAudioElement`，支持常用媒体属性、`play/pause/stop/seek/destroy` 与 `on*/off*` 事件。播放操作保持小程序的同步调用形态，失败通过 `onError` 通知；自动播放、编码格式与资源访问受浏览器限制，微信静音开关、来源策略及 WebAudio 后端选择只保留调用兼容。

`arrayBufferToBase64` / `base64ToArrayBuffer` 提供字节转换。`setKeepScreenOn`、`setEnableDebug`、键盘高度/内存监听、`getPerformance` 和 `reportMonitor` 仅兼容调用，不会产生微信系统能力或虚构指标；无等价事件的监听不会触发回调。`getRealtimeLogManager` 仅输出本地 console，支持 tag 和过滤文本标记，不向微信上传。降级告警遵循 `runtime.warnings`；API 级 `canIUse()` 只表示入口存在。逐项限制见 [Web 兼容矩阵](/guide/web-compat-matrix)。

## 开发期模板诊断

开发服务会区分未知/未注册标签与尚未适配的官方组件，输出标签、原始文件和行列位置。原生 WXML、layout、include/import 及 Vue SFC 内联/外部模板保留各自来源；共享模板按入口组件注册作用域分别检查。已注册组件、合法 HTML/SVG/MathML、模板控制标签和已适配组件不会误报。

诊断复用 `runtime.warnings.level`（`warn` / `error` / `off`）与 `dedupe`，默认警告并去重。`error` 只提升日志级别，不使编译失败；修正后再次出现或位置变化会重新提示。生产构建与生产页面不输出标签诊断。完整配置见 [Web 运行时配置](/config/web#开发期标签诊断)。

## 应用样式与组件边界

`app.vue` 的内联 `<style>`、`<style src="./app.css">` 和原生 `App` 入口样式共用注册与 HMR 链路。页面接收应用样式；自定义组件默认保持 `isolated`，可通过 `options.styleIsolation: 'apply-shared' | 'shared'` 或 `addGlobalClass` 接收应用样式，显式 `isolated` 优先于 `addGlobalClass`。Shadow DOM 保持独立；`shared` 仅支持接收应用样式，不会将组件样式反向传播到页面或其他组件。

- 应用样式与局部样式保留独立的 stylesheet，局部样式在后，合法的局部 `@import` 不会因应用规则前置而失效。
- `page` 只匹配页面宿主，不增加原有 `:host` 转换的选择器权重。主题 CSS 变量可沿宿主继承到隔离组件，局部主题仍可覆盖。
- 应用样式可以修改、移除和重新添加，不重新执行一次性的 App 生命周期。legacy 字符串模板保留节点时，样式更新不叠加事件监听器，也不丢失输入值与选区。

组件上的 `@click` / `bind:click` 只接收组件 `emit('click', payload)` / `triggerEvent('click', detail)`，不会再同时收到内部物理点击冒泡造成的重复回调。原生元素的 `@tap` / `bindtap` 仍映射浏览器点击；自定义事件的名称、`detail` 与显式 `bubbles` / `composed` 选项保持原样。Vue SFC 处理函数接收 emit payload，原生 WXML 处理函数接收含 `detail` 的事件对象。

同名 Boolean、String、Number、Object、Array 和 Function props 与组件方法分别保存；需要读取输入时使用 props/data。setup 方法按完整快照替换或移除，且优先于同名静态方法；清空 setup 快照后恢复最新静态定义。普通实例方法的显式赋值、访问器和不可配置属性不被框架热更新覆盖。

父级 `setData` 更新嵌套 Object / Array 路径时，只复制变更路径上的容器；显式提交整个对象或数组时，为该子树创建输入快照。同引用整值提交、复用旧嵌套值的新外层对象也能更新深层投影。函数保持可调用，未提交分支不复制；大对象增量更新优先使用具体路径。

现有限制：`<script setup>` 和 legacy 字符串模板的同节点同名捕获/冒泡处理器存在独立的处理器键冲突，暂需使用不同层级的节点；这不属于原生事件与组件事件的来源隔离。

## 鼠标与触摸输入

桌面主键拖动可产生 `touchstart` / `touchmove` / `touchend` / `touchcancel`，真实触摸沿用原生事件，两种输入可在同一设备交替使用。鼠标移出节点后继续完成原拖动；取消、窗口失焦和节点卸载会结束会话。普通节点提供 identifier、page/client 坐标和 force；现代 `type="2d"` Canvas 另有相对可见画布的 CSS 像素 x/y，保留 currentTarget 和事件冒泡，其他 Canvas 模式仍需分别验证。编译模板和 legacy 字符串模板共用这些规则。

滚轮、右键和笔输入不会转换为 touch。`catchtouchmove` 只阻止当前可取消输入的默认滚动，普通触摸绑定不锁住整个页面滚动。

## 视觉与组件适配

- 默认提供 375px 宽的居中小程序设备视口；移动宽度下自动铺满
- `rpx` 跟随设备容器宽度和 resize 更新
- `view`、`text`、`image`、`button`、`input`、`scroll-view`、`icon`、`progress`、`rich-text`、`navigator`、`swiper` / `swiper-item`、`canvas`、`video`、`cover-view` / `cover-image`、`movable-area` / `movable-view` 及常用表单组件使用独立运行时标签，不会过早降级为无语义 DOM
- `page` 和原生组件 WXSS 选择器通过 PostCSS 结构化转换
- `image.mode`、input 常用属性与事件、scroll-view 滚动状态、平滑定位与基础 refresher 已有适配
- `form`、`label`、`textarea`、checkbox/radio group 和 `switch` 支持表单收集、提交、重置及微信形状的交互事件
- `icon` 覆盖九种内建图标类型；`progress` 支持常用视觉属性、按每增长 1% 计时的 active 动画和去重的 `activeend`；`rich-text` 将字符串与节点数组统一转为经过脚本、事件属性、危险 URL 和 CSS 过滤的安全 DOM
- `navigator` 复用页面栈和 mini-program bridge；`swiper` 支持受控状态、触摸、autoplay 及 `change` / `transition` / `animationfinish` 事件
- `canvas` 使用真实 2D Canvas 承载高频绘图命令；`video` 同步常用媒体属性、微信形状事件，并允许 `createVideoContext` 跨 Shadow DOM 控制播放器
- `cover-view` / `cover-image` 保留媒体覆盖层的定位和层级；`movable-area` / `movable-view` 支持边界、方向限制、拖拽及微信形状移动事件
- `setWebRuntimeHost` / `resetWebRuntimeHost` 提供宿主注入边界；网络、存储、剪贴板、对话框和打开链接可由测试容器或业务宿主接管，未注入能力回退到浏览器 API。
- `navigateTo` 保活隐藏页面，`navigateBack` 恢复同一实例、数据和滚动位置；`redirectTo` / `reLaunch` 按页面栈语义触发 `onHide` / `onUnload`
- `App.onLaunch` / `App.onShow` 在首个页面挂载前触发，浏览器前后台切换会驱动去重的 `App.onHide` / `App.onShow`；launch options 与重新进入时的 enter options 分开维护
- `#app` 滚动由当前页面栈项持续持有，用户滚动和 `pageScrollTo` 都会写回页面状态；history/hash 模式禁用浏览器原生滚动恢复以避免双重恢复
- `getCurrentPages()` 返回当前活动路由栈，其他保活 tab 页面不会混入当前 tab 栈；路由 API 同时支持 Promise 与 `success` / `fail` / `complete` 回调
- 读取 `app.json.tabBar` 并在设备容器内渲染标准 App Shell；`switchTab` 缓存 tab 页面、关闭非 tab 页面并保持正确的 `onLoad` / `onShow` 语义
- `showTabBar` / `hideTabBar`、`setTabBarItem`、`setTabBarStyle`、badge 与 red-dot API 会真实更新布局和视觉状态

页面滚动回调的兼容范围如下：

| 能力 | Web Runtime |
| --- | --- |
| `onPageScroll` | 用户滚动和 `pageScrollTo` 均派发，先于本次 `onReachBottom` |
| `onReachBottom` 默认距离 | 距底部 50px 时派发一次；内容追加后可再次触发 |
| 页面位置恢复、内容不足一屏 | 不派发 `onReachBottom` |
| `page.json.onReachBottomDistance` 自定义距离 | 暂不支持，仍使用默认 50px |

需要保留旧的浏览器全宽行为时，将 `runtime.viewport.mode` 设置为 `responsive`。

### `scroll-view` 刷新与滚动动画

`scroll-with-animation` 使用浏览器平滑滚动，支持 `scroll-top`、`scroll-left`、公开属性赋值和 `scroll-into-view`，双轴目标由同一次定位提交。动画时长和曲线由浏览器决定。

同时启用 `scroll-y` 与 `refresher-enabled` 后，顶部向下拖动可触发刷新。支持阈值（默认 45px）、`refresher-triggered`、默认 black/white/none 样式、背景和 `slot="refresher"`。短拖动依次产生 `refresherpulling`、`refresherabort`；超过阈值后释放产生 `refresherpulling`、`refresherrefresh`。程序提交 `true` 同样先 pulling 再 refresh，完成后须显式提交 `false` 产生 `refresherrestore`；手势刷新不会自动把绑定数据改成 `true`，原值为 `false` 时仍需显式提交结束。

刷新事件不冒泡，`detail.dy` 为下拉距离；刷新位移与正常滚动状态独立，禁用或卸载会取消待执行动画及回调。滚轮、未到顶部、横向拖动和内层手势组件不触发外层刷新。阻尼、回弹及增强模式的高级能力仍有兼容限制。

## 浏览器路由

默认 `runtime.routing.mode` 为 `memory`，只维护小程序页面栈。部署到生产站点时可选择：

- `history`：使用 `/pages/foo/index` 路径，支持深链接与浏览器前进/后退；服务端需要把未知路径回退到 Web 入口。
- `hash`：使用 `#/pages/foo/index`，适合静态托管，不需要服务端配置。

`runtime.routing.base` 用于部署在子目录的站点，例如 `/mini`。两种浏览器模式都会把页面栈和地址栏状态同步，未配置时保持原有 `memory` 行为。

## 页面 Head 与首屏资源

`runtime.seo` 会在浏览器路由切换后同步页面 Head：页面 `navigationBarTitleText` 作为当前标题，`titleTemplate` 使用 `%s` 占位；`description` 写入 description meta，默认还会维护去掉 query/hash 的 canonical 链接。设置 `enabled: false` 可关闭。

`runtime.resourceHints.links` 支持去重注入 `preconnect`、`dns-prefetch`、`prefetch` 和 `preload`。它只影响浏览器文档，不改变小程序构建产物，也不等同于 SSR。

## 宿主注入

Web Runtime 默认读取浏览器 API。测试容器、沙箱或业务宿主可以在页面注册前调用 `setWebRuntimeHost()` 注入 `fetch`、`storage`、`clipboard`、`dialogs` 与 `open`；未提供的字段继续使用浏览器回退。宿主卸载时调用 `resetWebRuntimeHost()` 清理注入状态。

## 能力边界

- 支持 `wx:if` / `wx:for` / 插值等常见语法
- 支持小程序到 DOM 事件桥接（如 `bindtap`）
- 未覆盖的原生组件、平台 API 和宿主细节仍需在微信 DevTools / 真机验证
- `app.json.tabBar.custom: true` 只保留 tab 路由语义，不自动移植业务自定义 tabBar 组件
- DevTools 自动化截图只覆盖页面 WebView，不包含宿主原生 tabBar；仓库通过 case 级 WebView 视口基线与独立浏览器行为断言组合验收
