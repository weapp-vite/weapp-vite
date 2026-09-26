# Issue #1082：纯原生 classic 也复现首次模板更新失败

被测 HEAD：`f0abbe14d12dfa9179ca614580802fcfb78ad40b`；产品源码仍为 `9db20cb0f`。该 HEAD 全部 CI 为 31 success / 10 skipped。以下对照没有修改产品源码或安装的 IDE，所有临时配置、fixture 和测试探针均已恢复。

## 对照方法与结果

先将原生 Component 的模板内容放入非 WXML 文本源 `template.control`。一个普通 Vite 插件通过 `addWatchFile` 登记该文件，在 `generateBundle` 的 post 阶段将内容交给原生输出；测试只修改真实输入，产物仍由 Vite/Rolldown 写出。原生 Component 的计数、输入、实例标记、路由及两轮模板往返断言保持。

随后缩小应用：App 只执行 `App({})`，只保留原生预热页和 Component 页，移除 Vue 页面、store 与子组件依赖，关闭 webRuntime、autoRoutes 和自动导入；页面条件清单同步移除未使用路由。stateful 产物共 17 个文件，没有 Wevu vendor 或 Vue 页面/组件产物。

最后去掉生成插件，直接修改源 WXML，并分别检查 stateful 与 classic。classic 对照不配置 headless HMR transport、不等待 stateful client，改为等待真实 CLI 初始构建完成信号，并断言控制文件不存在；其产物只有 10 个文件，没有 stateful 控制、preload、update 或 runtime 文件。

| 应用与输入方式 | headless | 真实 DevTools |
| --- | --- | --- |
| 原 fixture，原生 Component 从非 WXML 源生成模板 | 🟢 6/6 DOM | 🔴 2/6 DOM |
| 纯原生 stateful，从非 WXML 源生成模板 | 🟢 6/6 DOM | 🔴 2/6 DOM |
| 纯原生 stateful，直接编辑源 WXML | 🟢 6/6 DOM | 🔴 2/6 DOM |
| 纯原生 classic，直接编辑源 WXML | 🟢 6/6 DOM | 🔴 2/6 DOM |

真实 IDE 均在首次 `edit-0` 失败：磁盘产物已满足新增 marker 检查，但 `.template-cycle` 期望 1 个、实际 0 个。没有到后续恢复步骤。这证明该现象不依赖 Wevu 应用运行时、自定义生成 hook 或 stateful 客户端；不代表已排除所有构建工具与 IDE 的交互因素。

另一次诊断在纯原生生成模式的初始页面准备完毕后清理 IDE 编译缓存。清理前后计数 2、输入、实例标记和路由均未变化，但首次模板更新仍失败（2/6）。该操作没有成为修复，也没有加入正式 suite；它是否清理了以下特定内存缓存并未被证明。

classic 驱动初版把 `expect.poll` 用在 beforeAll，框架拒绝且没有执行用例；改用 `vi.waitFor` 等待同一 CLI 完成信号后才得到表中 headless 结果。初版驱动错误单独保留，不计作产品失败。

## 写出、工厂与事件顺序

原 fixture 的生成模板控制另有只读观测：输入 `template.control` 和磁盘输出均包含新增节点，未改动的源 `index.wxml` 不含节点；原生写出窗口内仅有初始旧模板与一次新模板 refresh，没有旧内容回写。

- 初始 Component WXML：454 字节，SHA256 `780bb0fed1f37c217c021cb2ada3e1efb6bdf674eb9710f5b9927b268e11bccc`。
- 首次更新：511 字节，SHA256 `4305165d3073d008654dd4a6e90cc2033468f2d16185b97e149cff971026d155`。
- 失败时 AppService 可见工厂仍不含新增节点，SHA256 `613b3b6c8894e55595d423e5bcc2d6e4f03c7d460d505ef80247b55056a501db`，与此前 Wevu 的旧工厂相同。该工厂观测来自保留完整 fixture 的控制，不冒称纯原生变体也采集了相同工厂。

纯原生直接 WXML 对照中，源码与产物事件都落在编译之后的同一次合并失效处理；因此此前较大 fixture 中原生 WXML 提前失效的成功路径不能外推为所有原生场景均通过。

| 真实 IDE 场景（UTC+8） | 模板编译调用 | 源码/产物失效处理 |
| --- | --- | --- |
| 纯原生 stateful、直接 WXML | 15:08:16.806 / .813 | 15:08:17.199 |
| 纯原生 classic、直接 WXML | 15:32:10.859 / .865 | 15:32:11.257 / .259 |

## 进一步只读源码检查

安装包中的 `getWxmlFilesForTransCached` 不仅缓存文件名，也缓存包含 `replaceContent` 的结果。其强制刷新条件考虑 partial-compile key 和 Interface Builder 状态；已观察的 hotReload 调用只传入 config/lazyload，没有向此层传递 hotReloadFile。具体 SummerCompiler 实现会把各 WXML/WXS 文件的编译代码放入 content 映射，随后进入这一缓存结果。

这给出了比“外层缓存是否命中”更具体的旧内容来源候选，且与已观察的编译早于失效、磁盘为新内容但工厂缺少节点相符。仍没有直接读取运行中的缓存对象及其世代，也没有在允许修改的 IDE 代码中验证修正，所以不宣称唯一内部修复点已证实。

只读资源校验通过；签名显示 Tencent Technology (Shanghai) Company Limited，TeamIdentifier 为 FN2V63AD2J，签名时间为 2026-09-23。没有修改或重新签名安装包，也没有提交其第三方源码。

## 复现材料与验收状态

[完整归档](./issue1082-native-template-cache.json.gz) 解压 606406 字节，SHA256 `1fc9c4da8b2f50739ff5cab37ac5b556f4e3a41d3312d327af81c7f6648a022d`。归档包含各变体输入配置、普通生成插件、所有成功/失败日志与 DOM、产物清单/hash、工厂摘要、写出 trace、IDE 事件摘录和只读源码 hash。完整 IDE/工厂代码仅本地保留。

复现时保持现有真实 AppID、miniprogramRoot 和热重载配置，按归档中的变体从 IDE 外编辑实际源文件；测试使用原子替换保存。不要通过额外触碰文件、延迟发布、强制注入或放宽 DOM 断言将失败改成通过。

本轮仅补充诊断证据，无产品或 changeset 变更。#1086 继续草稿，原始 Wevu 断言保留；真实 runtime 与完整性能验收仍未完成。
