---
title: WXML 增强
description: WXML 增强，聚焦 guide / wxml 相关场景，覆盖 Weapp-vite 与 Wevu 的能力、配置和实践要点。
keywords:
  - 配置
  - guide
  - wxml
  - 增强
  - 聚焦
  - /
  - 相关场景
  - 覆盖
---

# WXML 增强

`weapp-vite` 对 WXML 做了两类增强：

- **自动收集 WXML 依赖**：把 `import` / `include` 引到的模板文件自动带进产物
- **事件语法糖（可选）**：允许写 `@tap="fn"`，构建时自动转换成原生 `bind:tap`

本页介绍它们的工作方式，以及不需要时如何关闭。

## 静态分析与额外文件

默认情况下，框架会扫描页面、组件、分包目录，解析 `import` / `include` 中的 `src`，将对应的 WXML 文件复制到产物目录，并保持路径一致。

> [!IMPORTANT]
> 该分析是静态的，无法推断运行时动态拼接的路径。当前版本的 `weapp.isAdditionalWxml` 仍为预留字段，**不会参与扫描**。如果必须走动态路径，请确保这些模板能通过某个固定的 `import` / `include` 被引用，或在构建流程中自行补充产物。

## 事件绑定语法糖（可选）

开启 `weapp.wxml` 后，可以使用类似 Vue 的 `@` 语法，Weapp-vite 会在构建时转换为原生事件写法：

```html
<!-- 源代码 -->
<view @tap="hello"></view>
<!-- 编译结果 -->
<view bind:tap="hello"></view>
```

对应关系示例：

| 写法                                        | 转换结果            |
| ------------------------------------------- | ------------------- |
| `@tap`                                      | `bind:tap`          |
| `@tap.catch`                                | `catch:tap`         |
| `@tap.mut`                                  | `mut-bind:tap`      |
| `@tap.capture`                              | `capture-bind:tap`  |
| `@tap.capture.catch` / `@tap.catch.capture` | `capture-catch:tap` |

更多事件类型可参考[官方事件分类](https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/event.html)。

> [!WARNING]
> 某些第三方 WXML 插件的格式化功能可能无法识别 `@tap` 等语法糖。当前版本暂无单独开关，建议直接使用原生 `bind:` 写法规避冲突。

## 当前可配置的范围

`weapp.wxml.excludeComponent` 控制扫描阶段的组件识别；`weapp.wxml.remove` 在最终模板输出阶段统一清理属性、显式指定的节点及普通注释，原生 WXML 与 Vue 编译产物共用此入口。`transformEvent` 等历史处理字段仍未接入用户配置，详见 [WXML 配置](/config/wxml.md#weapp-wxml)。

需要按运行环境或业务条件修改属性、改名标签时，可使用 [`weapp.wxml.transform`](/config/wxml#transform) 的同步／异步函数及 `ctx.edit` 工具。它处理最终模板，外部规则依赖通过 `ctx.addWatchFile` 显式注册。

## 解析方言与回归语料

共享解析核心 [`@weapp-vite/wxml`](/packages/wxml) 按输入方言处理模板，编译到 Web 时也保留该选择。legacy 和 xml 都允许带引号属性紧接下一属性，例如 `<view a="1"b='2'bare />`；方言选择区分宿主转义与实体行为，不是严格 XML 合规开关。preserve 保留原文，canonical 统一属性分隔。

京东 `jds`、QQ `qs` 仅在对应 `platform` 的默认原文标签中启用，显式 `rawTags` 会替换完整列表。消费者应固定实际输入的配置，不能通过把普通组件设成脚本或失败后更换方言来获得测试通过。

仓库通过离线冻结语料、公共 XML 差分、固定种子组合与编辑测试，以及 Node/浏览器独立验收检查这些边界。全平台语料与覆盖率是严格门禁，登记门槛不表示当前已全部通过；“100%”只指枚举集合，不代表穷尽全网、私有项目或所有输入，也不扩大平台构建与 runtime 支持范围。维护者入口及来源、许可、框架版本矩阵见[语料维护说明](https://github.com/weapp-vite/weapp-vite/blob/main/scripts/templateCorpus/README.md)。

**本轮检查点：整体未完成。** `all-platform-v1` 冻结 13,558 份真实内容去重模板、26,228 个来源成员，其中 7,075 份有真实非微信来源，250 个独立公开上游实际拥有模板来源。另登记的 269 个 repo@commit、264 个元数据独立身份包含输入或证据来源，不代替真实模板配额。

Node 与 headless Chromium 各通过完整语料的 14,584 个用例，并各完成 100,000 个合法组合、100,000 个明确非法变异和 10,000 条八步编辑序列。24 个生产文件没有 coverage-ignore；语句 1,172/1,172、函数 128/128、行 1,139/1,139 均为 100%，分支 1,164/1,171（99.40%）。当前核心的 464 份正式 v5 性能复验在 Node、Chromium 各通过 140 个速度门禁单元，无错误。新语料独立画像覆盖全部 135 组，在两个环境各完成 10 对预热、40 对正式采样、405 个汇总单元和 22,080 条正式样本；画像完成不表示新增速度门槛通过，不改写旧 464 份门禁的分母。历史失败、等量确认和后续通过报告分别保留。

整体仍受 Taro 4.3.2 Harmony JSUI 的开发、生产两个失败格子，以及旧 MPX 原始 1,302 字节安装日志附件缺失阻断。上述解析与覆盖率结果不能代替框架构建及证据完整性验收；逐平台统计和报告身份见[冻结语料与验收状态](https://github.com/weapp-vite/weapp-vite/blob/main/packages/wxml/test/corpus/README.md)。
