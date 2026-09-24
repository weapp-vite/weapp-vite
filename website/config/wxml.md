---
title: WXML 配置
description: Weapp-vite 会扫描 WXML 以完成组件自动导入、WXS 依赖分析与模板产物输出。本页说明 weapp.wxml 的配置项与当前生效范围。
keywords:
  - 配置
  - config
  - wxml
  - Weapp-vite
  - 会扫描
  - 以完成组件自动导入
  - wxs
---

# WXML 配置 {#wxml-config}

`weapp-vite` 会扫描 WXML 以完成组件自动导入、WXS 依赖分析与模板产物输出。本页说明 `weapp.wxml` 的配置项与当前生效范围。

[[toc]]

## `weapp.wxml` {#weapp-wxml}

默认值为 `true`。扫描选项 `excludeComponent` 用于组件识别；可选清理统一配置在 `remove`，作用于最终 emitted 模板，而不是源文件：

```ts
interface WxmlRemoveAttrRule {
  tag: string | string[]
  name: string | string[]
}

interface WxmlRemoveOptions {
  attr?: Array<string | WxmlRemoveAttrRule>
  tag?: string[]
  comment?: boolean
}

// weapp.wxml
type WxmlConfig = boolean | {
  excludeComponent?: (tagName: string) => boolean
  remove?: boolean | WxmlRemoveOptions
}
```

`WxmlRemoveAttrRule`、`WxmlRemoveOptions` 可从 `weapp-vite/config` 或 `weapp-vite/types` 导入。`transformEvent`、`scriptModuleExtension`、`scriptModuleTag`、`templateExtension` 仍是未接入用户配置的历史处理字段，不用于控制清理。

## 环境与预设 {#remove}

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig(({ mode }) => ({
  weapp: {
    wxml: {
      remove: mode === 'production',
    },
  },
}))
```

| 配置 | 行为 |
| --- | --- |
| 未配置 `remove` | 保持历史行为：不新增属性或节点删除，普通注释仍会清理 |
| `false` | 关闭可选清理，保留普通注释；不关闭条件编译、依赖分析和平台转换 |
| `true` | 删除 `data-testid`、`data-test`、`data-cy`、`data-qa` 四个精确属性及普通注释；不删除节点 |
| 对象 | 只执行显式配置，不叠加 `true` 的预设 |
| `{}` | 不执行可选清理 |
| `{ attr: [], tag: [], comment: true }` | 只删除普通注释 |

`true` 不隐含 production 限制，development 下显式配置 `true` 也会生效。环境边界由上面的 `mode` 表达式决定。将来新增清理维度不会自动加入该预设。

> [!WARNING]
> 测试属性也可能被业务代码或生产自动化读取。仅在确认不再依赖它们时启用清理。预设不包含 `role`、`aria-*`、整类 `data-*`、`id`、`class`、`style` 或业务组件属性。

## 属性与标签匹配 {#remove-matching}

```ts
export default defineConfig(({ mode }) => ({
  weapp: {
    wxml: {
      remove: mode === 'production'
        ? {
            attr: [
              'data-testid',
              { tag: ['view', 'text'], name: ['data-debug-*'] },
            ],
            tag: ['debug-panel', 'dev-only-*'],
            comment: true,
          }
        : false,
    },
  },
}))
```

- 字符串属性规则作用于所有标签；对象规则要求标签和属性名同时命中，只删属性，不删节点。
- 同一数组内按“或”匹配，多条规则取并集；没有顺序覆盖、否定规则、正则或 CSS 选择器。
- 名称区分大小写，匹配完整名称；只有显式 `*` 是通配符，表示名称内零个或多个字符。`view` 不匹配 `web-view`，`data-test` 不匹配 `data-testid`。
- 匹配对象是最终静态标签名。Vue 的 `<DebugPanel>` 通常输出 `debug-panel`；开启 HTML 映射后 `div` 可能输出为 `view`，应使用输出名称配置。
- 不求值 `is`、条件指令、属性插值或 WXS 内容，不按组件文件名、注册路径推断组件身份。

### 运行时保护

即使规则命中，平台指令（如 `wx:*`、`a:*`、`tt:*`、`s-*`）、事件绑定（包括 `bind_ready`、`bind1ready`、`worklet:*` 手势回调）、原生 `let:*` / `slot:*` 插槽绑定、框架生成的运行时元数据，以及模板导入和脚本模块所需属性也不会删除。生成的 scoped-style、ref、slot 等元数据同样受保护。

宽泛属性规则另外保留 `id`、`class`、`style`、`class:*`、`style:*`、`hidden`、`value`、`checked`、`slot`、`is`，因为最终模板无法可靠区分普通属性与 `v-show` / `v-model` 等生成属性。精确规则可以显式删除这些属性的普通版本，但不能绕过已识别的框架元数据保护。

任意自定义组件 prop 的业务必要性无法从最终模板推断；用户显式配置的规则仍可能删除它们。优先使用精确名称或标签限定规则，不建议 `attr: ['*']`。

## 整节点删除 {#remove-tag}

`tag` 删除匹配节点及其完整子树，支持成对标签、自闭合标签和嵌套同名标签。父节点被删除时包含全部子节点；只删子节点时保留父节点，不继续删除变空的祖先或相邻空白。

这是显式改变 UI 和组件实例存在性的功能，不是无损压缩，也不是保留子内容的 unwrap。它永远不属于 `remove: true`。

以下情况会中止构建并报告输出文件、行、列：

- 规则（包括通配符）命中 `block`、`slot`、`template`、`import`、`include`、`wxs` 或其他平台脚本模块标签。
- 删除条件链中的前置 `if` / `elif`，却保留后续分支，导致孤立分支或改变后续分支的可达条件。
- 启用清理后发现无法确定安全删除区间的非法模板结构。

应调整规则，或使用源码条件编译移除完整条件链；清理器不会把 `else` 擅自改为无条件节点。

> [!IMPORTANT]
> 最终模板中的节点删除不等于删除对应 JS、样式、`usingComponents` 注册或依赖包，也不保证模块初始化与父组件渲染逻辑停止执行。彻底移除开发组件及其副作用应使用源码条件编译。本功能不承诺跨产物 tree-shaking。

## 处理顺序与覆盖范围 {#remove-pipeline}

```text
原生 WXML / Vue SFC / 组件模板
  → 条件编译、平台与标签转换
  → 最终模板转换（包括 i18n）
  → remove：属性、显式节点、普通注释
  → HMR 产物比较 → Vite/Rolldown 输出
```

清理由统一的最终输出阶段处理，覆盖页面、组件、导入模板、普通分包和独立分包的 emitted 模板。Vue 的中间编译阶段保留注释，避免 `remove: false` 在到达最终阶段前就失效。

清理器使用结构化源区间，不重排保留部分，也不压缩文本或属性周围的空白。属性值、插值表达式、注释及 WXS/SJS 原始内容中的类似标签文本不会被当成节点删除。

微信平台沿用现行 WXML 的双层反斜杠转义，其他平台使用 XML 属性边界；清理不会改写保留的属性值，也不会根据 `componentFramework` 切换微信模板的清理语法。
仅清理注释时复用相同词法边界，不构建清理用的元素树；只有普通注释的模板不会额外触发平台归一化。

`comment: true` 只清理普通模板注释；以 `!`、`#`、`@` 开头的保留/指令注释和已识别工具标记会保留。条件编译仍由前序编译阶段处理，不受此开关控制。

### WebView glass-easel 适配状态 {#glass-easel-status}

**延期：等待官方正式支持后再实现。** `wxml.remove` 的 WebView glass-easel 专项适配不纳入本次交付。成对配置 `componentFramework: "glass-easel"` 与 `glassEaselWebview: true` 目前依赖最新 nightly，不能视为稳定版支持条件；本次不默认启用，也不再以这套实验配置作为清理功能的验收前提。

待官方正式文档、稳定版开发者工具和真机运行时提供支持后，再实现并验证对应的语法选择、组件/模板继承及增量构建行为。现行微信 WXML 与其他平台的清理能力不受影响。

## 旧配置迁移 {#remove-migration}

旧的 `weapp.wxml.removeComment` 和 `weapp.vue.template.removeComments` 原先未接入用户配置的实际编译流程，现已从这些用户配置类型中移除，不保留兼容别名：

| 旧配置意图 | 新配置 |
| --- | --- |
| 删除普通注释 | `weapp.wxml.remove: { comment: true }` |
| 保留普通注释 | `weapp.wxml.remove: false`，或 `{ comment: false }` |
| 删除指定测试属性 | `weapp.wxml.remove: { attr: ['data-testid'] }` |

`removeAttributes` 是早期提案名，不是配置别名。请使用统一的 `remove.attr`。Vue 的 `simplifyWhitespace` 仍是兼容性预留位；本功能不引入空白压缩。

> [!NOTE]
> `weapp.wxml = false` 保持原有基础扫描与产物输出行为；要明确关闭这里管理的可选清理，请使用 `weapp.wxml = { remove: false }`。

---

相关能力：
- [自动导入组件配置](/config/auto-import-components.md#weapp-autoimportcomponents)
- [WXS 配置](/config/wxs.md)
