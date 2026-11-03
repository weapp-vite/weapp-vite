# @weapp-vite/web

实验性的 H5 运行时与工具集，为 `weapp-vite` 工程提供最小化的浏览器适配能力：

- 将 `wxml` 模板编译为渲染函数，并在 Web Components 中渲染
- 支持 `wx` / `a` / `tt` / `s` 前缀的条件与循环指令，以及插值语法等常见模板语法糖
- 将小程序 `Page` / `Component` 映射为自定义元素，Shadow DOM 隔离样式与事件
- 事件桥接（如 `bindtap` → `click`），保留 `this.setData`、`this.triggerEvent` 等调用体验
- 提供宿主中立的小程序桥，并兼容 `wx.navigateTo` / `my.navigateTo` / `tt.navigateTo` 等路由调用，以及 `getCurrentPages`、`onLoad`、`onShow`、`onHide`、`onUnload` 生命周期
- `App` 级别的 `onLaunch` / `onShow` / `onHide` 回调、`getApp` 全局实例访问
- 为 `view`、`text`、`image`、`button`、`input`、`scroll-view`、`icon`、`progress`、`rich-text`、`navigator`、`swiper` / `swiper-item`、`canvas`、`video`、`cover-view` / `cover-image`、`movable-area` / `movable-view`、picker、slider 及常用表单组件提供保留小程序语义的 Web Components 适配
- 使用 PostCSS 转换 WXSS 选择器，支持 `page`、原生组件类型选择器、组合选择器和伪类
- `rpx` 根据实际设备容器宽度动态计算；默认宽屏下使用 375px 居中设备视口
- 提供 Vite 插件，自动把 `.wxml` / `.wxss` 转换为 Web 侧模块

> ⚠️ 当前阶段为 POC，功能与兼容性都较有限，只适合验证思路。

## 快速开始

在 `weapp-vite` 项目中准备根目录 `index.html` 后，可直接使用同一份小程序源码启动或构建 Web：

```bash
pnpm wv dev -p web --host
pnpm wv build -p web
```

仓库内所有 `e2e-apps/*` 与 `templates/*` 项目统一提供 `pnpm dev:web` 和 `pnpm build:web`。`pnpm e2e:web:build-projects` 会验证全部项目的生产构建，`pnpm e2e:web` 会通过 Playwright 逐项目启动并检查 `wx`、页面容器和当前路由。

```ts
import { defineComponent } from '@weapp-vite/web'
import template from './index.wxml'
import style from './index.wxss'

defineComponent('wv-hello-world', {
  template,
  style,
  component: {
    properties: {
      title: { type: String, value: 'Hello weapp-vite' },
    },
    data: () => ({
      description: '欢迎使用 weapp-vite 模板。',
    }),
    methods: {
      copyLink(event) {
        const url = event.currentTarget.dataset.url
        this.setData({ url })
        this.triggerEvent('copied', { url })
      },
    },
  },
})

document.body.innerHTML = '<wv-hello-world title="文档地址"></wv-hello-world>'
```

## 模板输入方言

`templateInput` 描述模板源码的平台与编码，独立于 Web 输出目标。直接使用 Vite 插件时，它是 `weappWebPlugin` 的顶层选项；在 `weapp-vite` 配置中，入口为 `weapp.web.pluginOptions.templateInput`：

```ts
import { weappWebPlugin } from '@weapp-vite/web/plugin'

weappWebPlugin({
  templateInput: { platform: 'weapp', syntax: 'xml' },
})
```

原生模板入口及其原生 include/import 依赖默认按各自后缀选择输入规则：

| 输入 | 默认规则 |
| --- | --- |
| `.wxml` | 微信 / `legacy` |
| `.axml`、`.ttml`、`.swan`、`.jxml`、`.xhsml` | 对应平台 / `xml` |
| 历史 `.qml`、`.ksml` | QQ、快手 / `xml` |
| `.html` | `xml` |
| 无已知后缀的依赖 | 继承父模板输入规则 |

`platform` 支持 `weapp`、`alipay`、`tt`、`swan`、`jd`、`xhs` 及历史 `qq`、`ks`；显式 `syntax: 'legacy' | 'xml'` 优先于平台和后缀默认。`rawTags?: readonly string[]` 替换完整原始脚本标签列表，未覆盖时按实际输入平台选择，并包含 `script`。识别脚本边界不代表执行该平台的脚本语言；当前 Web 脚本执行入口仍只处理 `wxs`。

Vue SFC 生成模板（含 `<template src>`）固定使用微信 / XML，不受原生模板选项覆盖。同一 `.wxml` 文件作为 SFC 外部模板时保留 XML 反斜杠，作为原生入口时默认按 legacy 解码；它们的原生 include/import 依赖仍按自身后缀及显式插件配置选择。

字符串模板的 `createTemplate(source, options?)` 接受同一组输入选项，省略时默认微信 / legacy：

```ts
import { createTemplate } from '@weapp-vite/web/runtime'

const render = createTemplate('<view>{{ message }}</view>', { syntax: 'xml' })
const output = render({ message: 'hello' })
```

`TemplateInputOptions` 从包主入口、`/runtime` 和 `/runtime/polyfill` 导出。完整插值中的表达式错误沿用 safe / compat / strict 执行策略；缺少 `}}`、破损标签或字符串等无法确定结构边界的完整模板会明确报错。输入方言支持不代表对应平台 runtime 已通过验收。完整说明见[模板输入方言](https://vite.weapp.dev/packages/web.html#模板输入方言)。

## 开发期模板诊断

Vite 开发服务会区分“未知或未注册标签”和“官方组件尚未实现 Web 语义”，提示标签、源文件及行列位置。检查使用原始 WXML、layout、include/import 依赖和 Vue SFC 模板的位置，外部 SFC 模板指向实际模板文件；共享模板按各入口的组件注册作用域分别判断。已注册组件、合法 HTML/SVG/MathML、已适配原生组件和模板控制标签不会误报。

诊断复用 `weappWebPlugin({ runtime: { warnings: { level: 'warn', dedupe: true } } })`：默认警告并去重，`off` 关闭，`error` 只提升日志级别，不中断编译。相同入口作用域、源文件、标签与原因的未变诊断不会重复输出；位置变化或修正后再次出现会重新提示。`dedupe: false` 允许重新编译时重复提示。生产构建与生产页面不输出这类标签诊断；运行时 API 降级告警仍遵循自身的 `runtime.warnings` 策略。

## 应用样式与隔离

`app.vue` 的内联 `<style>`、`<style src="...">`，以及原生 `App` 入口对应的样式文件，共用应用样式注册链路。样式进入页面的 Shadow Root，不依赖向 `document.head` 注入 CSS 来穿透 Shadow DOM。

- 页面先应用 app 样式，再应用自身样式；两者保留独立的 stylesheet，局部样式开头的合法 `@import` 不会因 app 规则而失效，相同优先级时页面声明仍可覆盖 app 声明。
- 自定义组件默认隔离 app 的选择器。`options.styleIsolation` 为 `apply-shared` 或 `shared` 时接收 app 样式；未设置 `styleIsolation` 时，`options.addGlobalClass: true` 也可开启。显式 `isolated` 优先于 `addGlobalClass`。
- `page` 选择器只命中页面宿主，不会在共享样式的子组件上重新设置页面主题；页面限定不增加原有 `:host` 转换的选择器权重。CSS 自定义属性仍按浏览器规则继承，局部主题可以覆盖继承值。
- 应用样式更新与一次性的 `App()` 生命周期分开：HMR 可以修改、移除、重新添加样式，已挂载和后续挂载的消费方读取同一份最新状态；卸载时解除订阅。
- legacy 字符串模板保留节点时，事件监听器按绑定所有权复用；样式更新不会叠加监听器或丢失输入值与选区，方法、别名或捕获配置变化时替换旧绑定，移除后不再拦截事件。

这些规则描述 app 样式的可见范围，不会取消 Shadow DOM，也不扩展页面样式向组件、组件样式向外传播的现有支持范围。

## 组件事件与属性

- 自定义组件上的 `click`、`input` 等事件绑定只接收组件通过 `triggerEvent` 或 Vue `emit` 发出的事件，不会再被内部同名原生 DOM 事件额外触发。原生控件事件和 `tap` 等已有手势别名保持原有交互。
- 组件事件保留原始名称、大小写和 `detail`，并遵循显式的 `bubbles`、`composed` 选项。捕获、`catch` 与 `capture-catch` 先区分事件来源，再决定是否处理或停止传播，不会吞掉另一通道的原生事件。Vue SFC 处理函数接收 emit payload，原生 WXML 处理函数接收含 `detail` 的事件对象。
- DOM 宿主属性承载 props 输入，公开实例的方法表承载组件方法。两者同名时，Boolean、String、Number、Object、Array 和 Function props 不会被方法安装改写，模板和公开实例仍可调用对应方法。方法表优先级仅用于声明的 prop 冲突；没有此类冲突的普通实例方法仍支持显式赋值或自有访问器覆写。
- setup 方法安装采用完整快照，替换或移除方法不会写入 props。保留 setup 方法优先于同名静态方法的顺序；清空 setup 快照后恢复最新静态定义。普通自有字段、访问器和不可配置属性不由框架热更新覆盖。
- 父级 `setData` 的嵌套 Object / Array 路径更新只复制本批变更路径上的容器；显式提交整个对象或数组时，为该子树创建输入快照。原地修改后的同引用提交，以及新外层对象复用旧嵌套值的提交，都能更新子组件的深层投影和继续转发的输入。函数引用保持可调用，未提交的分支不复制，普通未变值不重复触发观察器；大对象增量更新优先使用具体路径，避免整棵已提交子树的复制成本。

现有限制：`<script setup>` 的同节点同名事件捕获/冒泡处理器，以及 legacy 字符串模板中的同类组合，仍存在独立的处理器键冲突；该组合暂需使用不同层级的节点。这不属于上述原生事件与组件事件的来源隔离。

## 桌面鼠标与触摸事件

`touchstart` / `touchmove` / `touchend` / `touchcancel` 在真实触摸输入上保留原生事件；鼠标主键拖动会生成相应触摸序列。两种输入逐次判断，触屏桌面设备也可交替使用，不依赖设备级触摸能力探测。鼠标移出起始节点后仍向同一次拖动派发事件；取消、窗口失焦和节点卸载会终结会话。滚轮、右键和笔输入不会被转换为触摸事件。

普通节点的 `touches` / `changedTouches` 包含 `identifier`、`pageX/pageY`、`clientX/clientY` 和 `force`；结束时 `touches` 为空，`changedTouches` 保留最后坐标。现代 `type="2d"` Canvas 同时提供这些字段和相对可见画布的 CSS 像素 `x/y`，保留 `currentTarget` 与事件冒泡；其他 Canvas 模式不能据此认定行为等价。`catchtouchmove` 会阻止本次可取消输入的默认滚动，普通绑定不会全局锁住滚动。这些规则同时适用于编译模板和 legacy 字符串模板。

## 设备视口

默认配置模拟小程序页面视口：移动宽度下铺满，浏览器宽度达到 600px 后使用 375px 居中容器。页面、导航栏、`fixed` 元素和 `rpx` 共用这一区域。

```ts
weappWebPlugin({
  runtime: {
    viewport: {
      mode: 'mini-program',
      maxWidth: 375,
      desktopBreakpoint: 600,
    },
  },
})
```

已有项目需要保留浏览器全宽布局时，设置 `runtime.viewport.mode: 'responsive'`。

## 浏览器路由

默认使用 `memory` 模式，路由只在运行时页面栈内生效。生产站点可以根据部署方式开启地址栏同步：

```ts
weappWebPlugin({
  runtime: {
    routing: {
      mode: 'history', // 服务端回退到 index.html
      base: '/mini',
    },
  },
})
```

- `history` 使用真实路径，支持从 `/mini/pages/detail/index?sku=42` 深链接进入页面，并同步 `navigateTo`、`redirectTo`、`reLaunch`、`switchTab` 和 `navigateBack`。
- `hash` 使用 `#/pages/detail/index`，适合没有服务端 history fallback 的静态托管。
- 两种浏览器模式都会响应前进/后退事件并恢复页面栈；`base` 应与部署目录保持一致。
- 默认 `memory` 保持现有预览与测试行为，不修改浏览器地址栏。

## 宿主注入

Web Runtime 默认读取浏览器原语；测试容器、沙箱或业务宿主可以在注册页面前注入最小 host：

```ts
import { setWebRuntimeHost } from '@weapp-vite/web'

setWebRuntimeHost({
  fetch: hostFetch,
  storage: hostStorage,
  clipboard: hostClipboard,
  dialogs: hostDialogs,
  open: hostOpen,
})
```

注入对象只覆盖提供的能力，其余能力仍使用浏览器回退。测试结束或宿主卸载时调用 `resetWebRuntimeHost()`。

## 音频与平台 API 降级

`createInnerAudioContext()` 使用独立 `HTMLAudioElement`，提供 src、autoplay、loop、volume、playbackRate、startTime、currentTime、duration、buffered、paused，以及 `play/pause/stop/seek/destroy` 和对应的 `on*/off*` 事件。播放操作保持小程序的同步调用形态，浏览器播放失败通过 `onError` 通知；销毁会释放媒体和监听器。自动播放、编码格式及资源访问受浏览器策略约束；`useWebAudioImplement`、`obeyMuteSwitch`、`referrerPolicy` 不能复现微信能力，会输出降级告警。

| API | Web 行为 |
| --- | --- |
| `arrayBufferToBase64` / `base64ToArrayBuffer` | 转换原始字节，支持空缓冲区和较大数据。 |
| `setKeepScreenOn` / `setEnableDebug` | 兼容 Promise 与 `success/complete` 成功回调；不改变设备息屏策略或浏览器调试设置。 |
| `onKeyboardHeightChange` / `offKeyboardHeightChange` | 可调用，浏览器没有等价的微信键盘高度事件，不触发回调。 |
| `onMemoryWarning` / `offMemoryWarning` | 可调用，浏览器没有等价的微信内存告警，不触发回调。 |
| `getPerformance` | 返回可调用的性能对象与 observer；指标列表及支持类型为空，不生成微信性能数据或观察回调。 |
| `getRealtimeLogManager` | `info/warn/error` 写入本地 console；支持 tag 与过滤文本标记，不缓存或上传微信日志，`in()` 仅兼容调用。 |
| `reportMonitor` | 仅兼容调用，不向微信平台上报。 |

以上仅兼容调用的平台能力会输出可通过 `runtime.warnings` 关闭或去重的告警。`canIUse()` 的 API 级探测表示调用入口存在，不表示浏览器具有相应微信系统能力。

## 组件兼容

- `image.mode` 会映射到浏览器的 `object-fit` / `object-position`。
- `input` 同步 `name`、`value`、`placeholder`、`disabled`、`password`、`maxlength`、`focus`，并发送小程序形状的 `input` / `focus` / `blur` / `confirm` 事件。
- `scroll-view` 支持横纵滚动、初始滚动位置、动态 `scroll-into-view` 及带 `scrollLeft`、`scrollTop`、`deltaX`、`deltaY` 的 `scroll` 事件；`scroll-with-animation` 使用浏览器平滑滚动，属性与公开属性赋值共用双轴定位入口。
- `form` 统一收集带 `name` 的可用控件值，支持 `button form-type="submit|reset"`、`submit` / `reset` 事件及初始状态恢复。
- `label` 支持通过 `for` 关联控件，也支持包裹 `input`、`textarea`、`checkbox`、`radio`、`switch` 触发聚焦或选择。
- `textarea`、`checkbox-group` / `checkbox`、`radio-group` / `radio`、`switch` 支持常用属性、表单值和微信形状的交互事件；脚本同步属性不会误发 `change`。
- `navigator` 复用页面栈路由，支持 `navigate`、`redirect`、`switchTab`、`reLaunch`、`navigateBack`；`target="miniProgram"` 复用 `navigateToMiniProgram` / `exitMiniProgram` 及其回调。
- `swiper` / `swiper-item` 支持 current、item-id、横纵布局、循环、指示点、边距、触摸切换和 autoplay，并发送微信形状的 `change`、`transition`、`animationfinish` 事件；组件断开连接时会停止计时器。
- `picker` 支持 selector、multiSelector、date、time 与 region 模式，selector 可使用 `range-key`，并发送 `change`、`cancel`、`columnchange` 事件；region 在 Web 上仅提供当前层级文本编辑，`code` / `postcode` 不包含行政区数据。
- `picker-view` / `picker-view-column` 支持受控 value、滚动吸附、mask / indicator 样式及 `change`、`pickstart`、`pickend` 事件。
- `slider` 支持 min、max、step、value、颜色、block-size、show-value、disabled 与表单值，并发送 `changing` / `change` 事件。
- `icon` 支持九种微信内建类型及 size / color；未知类型稳定降级为 success。
- `progress` 支持 percent、show-info、线宽、颜色、圆角、字号及 active 动画，`duration` 与微信一致表示进度每增长 1% 的毫秒数；每次真实动画完成后发送一次 `activeend`，颜色等非动画属性更新不会重复发送完成事件。
- `rich-text.nodes` 通过 property 保留节点数组，也支持 HTML 字符串；两种输入统一归一化为安全节点树，过滤脚本、事件属性、危险 URL 与危险 CSS 后再使用 DOM API 创建内容，不直接注入任意 `innerHTML`。
- `canvas` 在 Shadow DOM 内维护真实 2D Canvas，支持通过 `canvas-id` / `id` 创建上下文，并桥接矩形、文字、路径、圆弧、填充、保存恢复和常用变换命令。
- `video` 同步 src、poster、autoplay、loop、muted、controls、initial-time 与 object-fit；`createVideoContext` 可跨 Shadow DOM 控制对应播放器，并发送微信形状的播放、进度、元信息、错误和全屏事件。
- `cover-view` / `cover-image` 在媒体或图片上方保留绝对定位与层级；`cover-image` 复用 image 的 mode、src 和 load/error 事件。
- `movable-area` / `movable-view` 提供裁剪边界、初始 x/y、direction、disabled、out-of-bounds、animation 及 pointer 拖拽，并发送带 x/y/source 的 `change`、`htouchmove`、`vtouchmove` 事件。
- `setWebRuntimeHost` / `resetWebRuntimeHost` 提供宿主注入边界；网络、存储、剪贴板、对话框和打开链接优先使用注入实现，未注入时回退到浏览器 API。
- 其他已识别但尚未完整适配的原生组件保留降级渲染，开发服务通过模板诊断提示兼容边界。

### `scroll-view` 下拉刷新

同时启用 `scroll-y` 和 `refresher-enabled` 后，容器在顶部接收向下拖动。支持 `refresher-threshold`（默认 45px）、`refresher-triggered`、`refresher-default-style="black|white|none"`、`refresher-background` 和 `slot="refresher"` 自定义内容。滚轮不会触发刷新，横向、向上、未到顶部的拖动及内层滚动/手势组件保留自己的输入。

- 未达到阈值时释放：`refresherpulling` → `refresherabort`。
- 达到阈值时释放：`refresherpulling` → `refresherrefresh`；用户拖动不会自动把绑定数据改成 `true`。
- 显式提交 `refresher-triggered: true`：展开后依次触发 `refresherpulling`、`refresherrefresh`。
- 刷新完成后显式提交 `false`：触发 `refresherrestore` 并收回，即使绑定数据原本就是 `false` 也可结束手势刷新。无关数据更新不会结束刷新。

四种刷新事件均不冒泡，`detail.dy` 表示当前或结束前的下拉距离。视觉回弹与滚动位置分别维护，禁用和卸载会取消待执行动画及回调。浏览器平滑滚动、拖动阻尼和动画节奏为基础近似，不承诺微信原生物理效果或增强模式的全部能力。

## 页面栈与生命周期

- 首次挂载页面前依次触发 `App.onLaunch` / `App.onShow`；浏览器 `visibilitychange` 会驱动去重的 `App.onHide` / `App.onShow`。支持 `wx.onAppShow` / `wx.offAppShow` / `wx.onAppHide` / `wx.offAppHide`：冷启动先执行 App 显示钩子，再执行 wx 监听器；后续恢复与隐藏先执行 wx 监听器，再执行 App 钩子。浏览器无法区分微信退出来源，隐藏时统一向监听器和 App 钩子传递同一份 `{ reason: 3 }`（其他原因）。`getLaunchOptionsSync()` 保留初始入口，`getEnterOptionsSync()` 在重新进入前台时更新为当前页面。
- `navigateTo` 会保留原页面 DOM、实例和数据，并依次触发原页面 `onHide` 与新页面 `onLoad` / `onShow`。
- `navigateBack` 只卸载出栈页面，恢复目标页面的同一实例、`onShow` 和页面容器滚动位置，不会重新触发 `onLoad`。当前页持续拥有 `#app` 的滚动状态，用户滚动与 `pageScrollTo` 都会写回对应栈项。
- `redirectTo` 只替换并卸载当前页面；`reLaunch` 会从栈顶开始卸载全部旧页面后挂载目标页面。
- `getCurrentPages()` 返回当前活动路由栈；其他 tab 页面可保活但不会混入当前 tab 栈。路由 API 支持 `success` / `fail` / `complete` 回调与 Promise 结果。
- `history` / `hash` 模式使用 `history.scrollRestoration = 'manual'`，避免浏览器窗口滚动与小程序设备容器同时恢复位置；关闭路由同步时会还原原值。

## 页面 Head 与首屏资源

启用 `runtime.seo` 后，页面配置中的 `navigationBarTitleText` 会在路由切换时同步到 `document.title`，并可统一写入 description 与 canonical。`titleTemplate` 使用 `%s` 代表当前页面标题：

```ts
weappWebPlugin({
  runtime: {
    seo: {
      defaultTitle: '商城',
      titleTemplate: '%s | Web Demo',
      description: '小程序页面的 Web 运行时演示。',
    },
  },
})
```

`resourceHints.links` 会去重注入 `preconnect`、`dns-prefetch`、`prefetch` 或 `preload` 链接，适合声明首屏字体、图片和 API 域名：

```ts
const runtime = {
  resourceHints: {
    links: [{ rel: 'preconnect', href: 'https://cdn.example.com' }],
  },
}
```

Head 管理只在浏览器文档存在时生效，不会把客户端路由误认为完整 SSR；服务端预渲染仍需要后续接入独立的 HTML 入口。

## App Shell 与 tabBar

- Vite 插件会读取 `app.json.tabBar`，标准 tabBar 在 Web 侧使用受设备视口约束的 App Shell 渲染；颜色、背景、边框、图标、文字和底部安全区由同一份配置驱动。
- `switchTab` 只接受 tabBar 路由。切换时关闭非 tab 页面，缓存其他 tab 页面实例；再次切回会恢复原数据并触发 `onShow`，不会重复触发 `onLoad`。
- `showTabBar` / `hideTabBar` 会真实改变布局；`setTabBarItem`、`setTabBarStyle`、badge 与 red-dot API 会同步更新当前 shell。
- tabBar 页面与普通页面共享 `#app` 设备容器。页面底部 inset、宽屏居中边界和安全区变量会随 tabBar 显隐同步更新。
- `tabBar.custom: true` 会保留 tab 路由与 `switchTab` 语义，但不会渲染标准 shell；自定义 tabBar 组件仍需业务侧实现。

仓库中的 `pnpm e2e:web:update-baselines` 只用于维护者显式刷新微信 DevTools 视觉基线；普通 `pnpm e2e:web` 只读取已提交基线。

微信 DevTools 的 `App.captureScreenshot` 只截取页面 WebView，不包含宿主原生导航栏和 tabBar。视觉 manifest 会记录每个页面实际截图视口；标准 tabBar 的高度、安全区、选中态与动态 API 由浏览器行为 E2E 单独验证。

## TODO

- 更全面的模板语法和原生组件语义
- 继续扩展组件属性系统和页面级滚动事件
- 全局 API 兼容层与更精细的样式适配
- SSR / 服务端预渲染入口
