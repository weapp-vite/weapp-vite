# 微信开发者工具 API Surface 报告

> 本报告由 `pnpm report:wechat-devtools-api` 生成。微信开发者工具更新后重新运行该命令；提交前可运行 `pnpm check:wechat-devtools-api-report` 检查报告是否与当前源码和本机 DevTools 版本一致。

## 范围

这里的“暴露给当前仓库/AI 工具的 API”指 weapp-vite 通过 `weapp-ide-cli`、`miniprogram-automator` 和 MCP 工具实际封装并可调用的 DevTools HTTP 服务端口与 automator WebSocket 协议面。微信开发者工具内部未被当前仓库调用的私有接口不视为稳定可用面。

## 元信息

| key | value |
| --- | --- |
| 生成时间 | 2026-06-24T03:47:40.734Z |
| DevTools 应用路径 | /Applications/wechatwebdevtools.app |
| DevTools package.json | /Applications/wechatwebdevtools.app/Contents/Resources/package.nw/package.json |
| DevTools 产品名 | 微信开发者工具 |
| DevTools 版本 | 2.01.2510290 |
| DevTools buildTime | 1774078780548 (2026-03-21T07:39:40.548Z) |
| HTTP 服务端口 | 默认 9420；运行时优先读取微信开发者工具设置/本仓库 runtime port |
| Automator WS 地址 | 通过 DevTools CLI auto 启动，连接 ws://127.0.0.1:<auto-port> |

## HTTP 服务端口

| endpoint | query | result | source | note |
| --- | --- | --- | --- | --- |
| GET /open | projectpath=<absolute project path> | 打开或刷新目标项目 | packages/weapp-ide-cli/src/cli/http.ts | 服务端口默认 9420；优先读取 DevTools 设置里的端口 |
| GET /v2/resetfileutils | project=<absolute project path> | 重置当前项目 fileutils 状态 | packages/weapp-ide-cli/src/cli/http.ts | 用于修复 IDE 文件状态缓存 |
| GET /engine/build | projectpath=<absolute project path> | 触发 engine build | packages/weapp-ide-cli/src/cli/http.ts | 返回原始 body |
| GET /engine/buildResult/ | - | 轮询 engine build 状态 | packages/weapp-ide-cli/src/cli/http.ts | 已知状态：NOT_START / OPEN_PROJECT / BUILDING / END / ERROR |

## Automator WebSocket 方法

请求形态为 JSON：`{ id, method, params }`。响应按同一 `id` 回包；事件没有 `id`，通过 `method` 区分。

| domain | method | params | result | source | note |
| --- | --- | --- | --- | --- | --- |
| App | App.getPageStack | - | pageStack | MiniProgram.pageStack/currentPage/changeRoute | 读取页面栈，也用于 currentPage 超时兜底 |
| App | App.getCurrentPage | - | pageId/path/query | MiniProgram.currentPage/changeRoute | 当前页探测和路由等待 |
| App | App.callWxMethod | method, args, pluginId? | result | MiniProgram.callWxMethod/callPluginWxMethod | 导航、系统信息、宿主 wx API 调用入口 |
| App | App.mockWxMethod | method, result?, functionDeclaration?, pluginId?, args? | - | MiniProgram.mockWxMethod/mockPluginWxMethod | mock/restore wx API |
| App | App.callFunction | functionDeclaration, args | result | MiniProgram.evaluate | 在 App 上下文执行函数 |
| App | App.exit | - | - | MiniProgram.close | 关闭小程序运行实例 |
| App | App.enableLog | - | - | MiniProgram.enableLog | 启用 console 事件转发 |
| App | App.addBinding | name | - | MiniProgram.exposeFunction | 暴露绑定函数给小程序侧调用 |
| App | App.captureScreenshot | - | data | MiniProgram.waitForAppReady/screenshot | 截图和 App 域 ready 探测 |
| Tool | Tool.close | - | - | MiniProgram.close | 关闭 DevTools 自动化会话 |
| Tool | Tool.enableRemoteDebug | auto | qrCode? | MiniProgram.remote | 开启远程调试 |
| Tool | Tool.getInfo | - | SDKVersion 等信息 | MiniProgram.checkVersion/toolInfo | 版本与工具信息 |
| Tool | Tool.compile | compile options | compile result | MiniProgram.compile | 触发 IDE 编译 |
| Tool | Tool.clearCache | clean options | clear result | MiniProgram.clearCache | 清理 IDE 缓存 |
| Tool | Tool.stopAudits | - | data/report | MiniProgram.stopAudits | 结束体验评分并读取报告 |
| Tool | Tool.getTicket | - | ticket payload | MiniProgram.getTicket | 读取登录 ticket |
| Tool | Tool.setTicket | ticket | - | MiniProgram.setTicket | 写入登录 ticket |
| Tool | Tool.refreshTicket | - | - | MiniProgram.refreshTicket | 刷新登录 ticket |
| Tool | Tool.getTestAccounts | - | accounts | MiniProgram.testAccounts | 读取测试账号 |
| Tool | Tool.native | method, data? | native result | Native.sendNative | 原生弹窗/授权/分享/支付等宿主 UI 操作 |
| Tool | Tool.<method> | params | method result | MiniProgram.tool | 显式开放 Tool 域透传入口 |
| Page | Page.getElement | pageId, selector | element | Page.$ | 查找单个节点 |
| Page | Page.getElements | pageId, selector | elements | Page.$$ | 查找多个节点 |
| Page | Page.getElementByXpath | pageId, selector | element | Page.$x | XPath 单节点查询 |
| Page | Page.getElementsByXpath | pageId, selector | elements | Page.$$x | XPath 多节点查询 |
| Page | Page.getData | pageId, path? | data | Page.data | 读取页面 data |
| Page | Page.setData | pageId, data | - | Page.setData | 写入页面 data |
| Page | Page.callMethod | pageId, method, args | result | Page.callMethod | 调用页面实例方法 |
| Page | Page.getWindowProperties | pageId, names | properties | Page.windowProperty/size/scrollTop | 读取 window/document 属性 |
| Element | Element.getElement | pageId, elementId, selector | element | Element.$ | 在元素内查找单个子节点 |
| Element | Element.getElements | pageId, elementId, selector | elements | Element.$$ | 在元素内查找多个子节点 |
| Element | Element.getOffset | pageId, elementId | offset | Element.offset | 读取节点位置 |
| Element | Element.getWXML | pageId, elementId, type | wxml | Element.wxml/outerWxml | 读取 inner/outer WXML |
| Element | Element.tap | pageId, elementId | - | Element.tap | 点击节点 |
| Element | Element.triggerEvent | pageId, elementId, type, detail? | - | Element.trigger | 触发组件事件 |
| Element | Element.touchstart | pageId, elementId, touches? | - | Element.touchstart | 触摸开始 |
| Element | Element.touchmove | pageId, elementId, touches? | - | Element.touchmove | 触摸移动 |
| Element | Element.touchend | pageId, elementId, changedTouches? | - | Element.touchend | 触摸结束 |
| Element | Element.dispatchEvent | pageId, elementId, eventName, detail? | - | Element.dispatchEvent | 派发 DOM 事件 |
| Element | Element.callFunction | pageId, elementId, functionName, args | result | Element.callFunction | 调用内置元素函数，如 input.input |
| Element | Element.setData | pageId, elementId, data | - | CustomElement.setData | 写入自定义组件 data |
| Element | Element.getData | pageId, elementId, path? | data | CustomElement.data | 读取自定义组件 data |
| Element | Element.callMethod | pageId, elementId, method, args | result | CustomElement.callMethod | 调用自定义组件方法 |
| Element | Element.callContextMethod | pageId, elementId, method, args | result | ContextElement.callContextMethod | 调用 video 等上下文方法 |
| Element | Element.getDOMProperties | pageId, elementId, names | properties | Element.domProperty | 读取 offsetWidth/innerText 等 DOM 属性 |
| Element | Element.getAttributes | pageId, elementId, names | attributes | Element.attribute | 读取属性 |
| Element | Element.getStyles | pageId, elementId, names | styles | Element.style | 读取样式 |
| Element | Element.getProperties | pageId, elementId, names | properties | Element.property/_property | 读取组件公开属性 |

## Automator WebSocket 事件

| event | payload | source | note |
| --- | --- | --- | --- |
| App.logAdded | console payload | MiniProgram.on("console") | 启用 App.enableLog 后转发 |
| App.bindingCalled | name, args | MiniProgram.exposeFunction | 小程序侧调用绑定函数 |
| App.exceptionThrown | exception payload | MiniProgram constructor | 小程序异常事件 |
| Tool.onRemoteDebugConnected | - | MiniProgram.remote | 远程调试连接完成 |

## Tool.native 子命令

这些不是独立 WS method，而是 `Tool.native` 的 `params.method`。

| method | transport | params | source |
| --- | --- | --- | --- |
| goHome | Tool.native | - | packages/miniprogram-automator/src/Native.ts |
| navigateLeft | Tool.native | - | packages/miniprogram-automator/src/Native.ts |
| confirmModal | Tool.native | - | packages/miniprogram-automator/src/Native.ts |
| cancelModal | Tool.native | - | packages/miniprogram-automator/src/Native.ts |
| switchTab | Tool.native | url | packages/miniprogram-automator/src/Native.ts |
| authorizeCancel | Tool.native | - | packages/miniprogram-automator/src/Native.ts |
| authorizeAllow | Tool.native | - | packages/miniprogram-automator/src/Native.ts |
| closePaymentDialog | Tool.native | - | packages/miniprogram-automator/src/Native.ts |
| shareCancel | Tool.native | - | packages/miniprogram-automator/src/Native.ts |
| shareConfirm | Tool.native | - | packages/miniprogram-automator/src/Native.ts |

## MCP 工具映射

MCP 工具是本仓库面向 AI/客户端暴露的包装层，不是微信开发者工具原生接口；底层仍走上面的 HTTP/WS 能力。

| tool | mapsTo | note |
| --- | --- | --- |
| weapp_devtools_connect | currentPage, systemInfo -> App.getCurrentPage/App.callWxMethod | 连接并返回当前页和系统信息 |
| weapp_devtools_active_page | Page.getWindowProperties/Page.getData | 读取当前页状态 |
| weapp_devtools_page_stack | App.getPageStack | 读取页面栈 |
| weapp_runtime_find_node | Page.getElement + Element snapshot methods | 单节点快照 |
| weapp_runtime_find_nodes | Page.getElements + Element snapshot methods | 多节点快照 |
| weapp_runtime_tap_node | Page.getElement + Element.tap | 点击节点 |
| weapp_runtime_input_node | Page.getElement + Element.callFunction | 输入文本 |
| weapp_devtools_capture | App.captureScreenshot | 截图并可保存到文件 |
| weapp_devtools_host_api | App.callWxMethod | 调用 wx API |
