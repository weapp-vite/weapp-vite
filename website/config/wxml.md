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
  transform?: WxmlTransform | WxmlTransform[]
  validate?: WxmlValidate | WxmlValidate[]
}
```

`WxmlRemoveAttrRule`、`WxmlRemoveOptions` 可从 `weapp-vite/config` 或 `weapp-vite/types` 导入。`transformEvent`、`scriptModuleExtension`、`scriptModuleTag`、`templateExtension` 仍是未接入用户配置的历史处理字段，不用于控制清理。

## 函数式转换 {#transform}

`weapp.wxml.transform` 接收一个函数或函数数组，支持异步。每个函数收到当前模板源码；数组按声明顺序等待执行。返回 `null` / `undefined` 保持当前源码，返回空字符串清空模板。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    wxml: {
      transform: async (code, ctx) => {
        if (ctx.isDev)
          return
        return ctx.edit(code, (node) => {
          if (node.tagName === 'view')
            node.removeAttribute('data-testid')
          if (node.tagName === 'button') {
            node.renameAttribute('data-track', 'data-analytics')
            if (!node.hasAttribute('hover-class'))
              node.setAttribute('hover-class', 'none')
            node.setAttribute('disabled', { expression: 'submitting' })
          }
          if (node.tagName === 'text' && node.hasAttribute('data-use-view')) {
            node.renameTag('view')
            node.removeAttribute('data-use-view')
          }
        })
      },
    },
  },
})
```

匹配编译后的静态标签名，例如 Vue HTML 映射后的 `view`。第一版只转换最终模板：替换成自定义组件时，仍需通过既有 `usingComponents` 等配置注册组件；不会生成组件依赖、JS 或样式。

### 回调上下文

| 字段 / 方法 | 含义 |
| --- | --- |
| `fileName` | 相对输出根目录的 POSIX 文件名，包含分包目录 |
| `root` | 项目根目录 |
| `platform` / `mode` / `isDev` | 当前平台、模式及开发状态 |
| `subPackageRoot` | 独立分包构建的根目录；主包构建（含普通分包）为 `undefined` |
| `edit(code, visitor)` | 返回 `Promise<string>`，支持异步 visitor |
| `addWatchFile(path)` | 注册外部文件依赖，相对路径从项目根目录解析 |
| `warn(message)` / `error(message)` | 报告警告 / 中止本轮构建 |

`WxmlTransform`、`WxmlTransformResult`、`WxmlTransformContext`、`WxmlTransformVisitor`、`WxmlTransformNode`、`WxmlElementInfo`、`WxmlAttribute`、`WxmlAttributeValue`、`WxmlSourceLocation` 均可从 `weapp-vite/config` 和 `weapp-vite/types` 导入。回调执行于构建端，可以使用闭包、正则和异步读取；非法返回值或异常会中止输出，并报告文件名、回调序号及原始错误。

### 编辑节点与属性值

`ctx.edit` 每次只扫描一次，按源码顺序深度优先遍历标签。未修改的区间逐字保留；WXS 等脚本模块的原始内容不作为标签遍历。

- `tagName`、`attributes`、`parent`、`location` 为只读观察信息；位置包含从零开始的 `offset` 和从一开始的 `line` / `column`。父节点没有修改接口。
- `hasAttribute(name)` 和 `getAttribute(name)` 读取当前编辑状态。属性记录包含 `name`、原始 `rawValue` 与 `quote`，不求值动态或混合绑定；无值属性的 `rawValue` 为 `null`。
- `setAttribute(name, value)` 设置属性：字符串为字面量，数字和布尔值输出保持类型的绑定，`{ expression: 'submitting' }` 输出模板表达式。不要给表达式再包 `{{ }}`。
- `setBooleanAttribute(name)` 设置无值属性。`setAttribute(name, false)` 保留布尔 `false` 语义，不表示删除。
- `renameAttribute(from, to)` 保留原值，目标存在时抛错；源不存在时无操作。删除清除全部同名项，设置将重复属性收敛为一个。
- `renameTag(name)` 同时改开始和结束标签；`remove()` 删除整个子树并跳过子节点回调。

同一节点后续操作可以读取已修改状态。编辑句柄仅在当前 `edit` 会话内有效。不提供节点移动、插入或 unwrap；需要这些操作时可自行返回完整源码。

编辑工具沿用关键属性、结构标签及条件链保护。明确修改事件、平台指令或已识别的框架元数据会抛错并附带位置。直接返回源码允许完整控制，不提供上述语义保护；后续 `remove` 与宿主编译检查仍会执行。

### 输出顺序与热更新

执行顺序：模板编译 / 平台归一化 / i18n → `transform` → `remove` → 既有 Tailwind 与 compiler-plugin 输出处理 → `validate` → HMR 内容比较 → bundler 输出。后续输出插件仍可修改模板。独立分包转换完成后汇入主包，不重复转换。

外部规则文件必须显式调用 `ctx.addWatchFile('rules.json')`，建议在读取前注册，以便文件缺失导致构建失败后仍能恢复。外部依赖修改、删除、恢复会触发完整模板重建，覆盖主包、普通和独立分包。同一文件跨模板注册会去重；不自动追踪任意文件读取、环境变量或网络请求，也不允许监听构建输出目录。

每轮从当前编译输入重新转换，避免连续 HMR 累加上轮结果。回调应根据输入与显式依赖生成结果；不保证跨文件、跨分包的全局调用顺序，也不保证整个开发会话只调用一次。未配置 `transform` 时不增加编辑扫描；只返回字符串而不调用 `edit` 时，也不会为了回调额外解析模板。

## 最终模板校验 {#validate}

`weapp.wxml.validate` 在 `transform`、`remove` 和框架管理的 Tailwind / compiler-plugin 输出处理完成后执行，在 HMR 内容比较和发布前检查模板。可用于禁止调试节点残留、检查指定标签的必填属性或验证项目约定；默认不启用任何规则。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    wxml: {
      remove: { attr: [{ tag: 'view', name: 'data-testid' }] },
      validate: async (_code, ctx) => {
        if (ctx.isDev) {
          return
        }
        await ctx.walk((node) => {
          if (node.tagName === 'debug-panel') {
            ctx.report({
              severity: 'error',
              code: 'no-debug-panel',
              message: '发布模板不能包含 debug-panel',
              location: node.location,
            })
          }
          if (node.tagName === 'button' && !node.hasAttribute('data-track')) {
            ctx.report({
              severity: 'warning',
              code: 'button-tracking',
              message: 'button 缺少 data-track',
              location: node.location,
            })
          }
        })
      },
    },
  },
})
```

### 校验接口与诊断

```ts
type WxmlValidate = (
  code: string,
  ctx: WxmlValidationContext,
) => void | Promise<void>

interface WxmlValidationDiagnostic {
  severity: 'warning' | 'error'
  code?: string
  message: string
  location?: WxmlSourceLocation
}

// weapp.wxml
// validate?: WxmlValidate | WxmlValidate[]
```

`WxmlValidate`、`WxmlValidationContext`、`WxmlValidationVisitor`、`WxmlValidationDiagnostic` 均从 `weapp-vite/config` 和 `weapp-vite/types` 导出。

- 单函数和函数数组都支持异步；数组按声明顺序等待，所有回调读取同一份模板。返回值必须为 `undefined`，返回字符串、`null`、`false` 等会报错；修改模板请使用 `transform`。
- `ctx.walk(visitor)` 返回 `Promise<void>`，须 `await` 或 `return`。同步／异步 visitor 按源码顺序深度优先访问节点；同一模板在本轮多个回调间复用一次扫描，只检查 `code` 而不遍历时不解析。
- 节点使用只读 `WxmlElementInfo`：`tagName`、`attributes`、`parent`、`location`、`hasAttribute`、`getAttribute`；没有 `setAttribute`、`renameTag` 或 `remove`。属性、父节点和位置不可改写。
- 属性 `rawValue` 不解码、不求值，`{{tracking}}` 不代表已知运行时值。静态值规则只比较可确定的字面内容，校验不能判断页面数据变化后的属性值。
- `ctx.report` 的 `warning` 允许输出，`error` 汇总当前构建内其他回调及模板的正常诊断后阻止输出。同轮同文件、回调、严重程度、代码、消息和位置均相同的诊断去重。
- 诊断包含输出相对路径、从 1 开始的回调序号、可选规则代码和行列；不传 `location` 时为文件级诊断。位置对应本轮最终模板，不映射回 `.vue` 源文件。
- 回调异常、扫描失败、非法返回值或诊断格式立即中止并保留原始错误；没有静默跳过或自动修复。失败不会推进该构建的成功输出缓存，独立分包失败会传递到主构建。

上下文提供与 `transform` 相同含义的 `fileName`、`root`、`platform`、`mode`、`isDev`、`subPackageRoot` 和 `addWatchFile`；不提供 `edit`，校验诊断统一通过 `report` 发出。

### 按范围校验与复用规则

下面把普通分包的静态属性检查拆成可复用函数；`fileName` 为输出相对 POSIX 路径，`subPackageRoot` 只标识独立分包构建，普通分包应按路径筛选。

```ts
import type { WxmlValidate } from 'weapp-vite/config'
import { defineConfig } from 'weapp-vite/config'

const checkCheckout: WxmlValidate = async (_code, ctx) => {
  if (ctx.platform !== 'weapp' || !ctx.fileName.startsWith('packages/checkout/')) {
    return
  }
  await ctx.walk((node) => {
    if (node.tagName === 'button' && node.getAttribute('data-track')?.rawValue === '') {
      ctx.report({ severity: 'error', message: '静态埋点属性不可为空字符串', location: node.location })
    }
  })
}

export default defineConfig({
  weapp: { wxml: { validate: [checkCheckout] } },
})
```

校验按最终静态标签名匹配，因此 Vue HTML 映射后的 `div` 通常需要检查 `view`。已被 `remove` 删除的节点不会再命中；输出插件新添加的节点会被检查。独立分包在所属构建中校验一次，汇入主包不重复执行。

### 外部规则与 HMR

外部规则文件与转换阶段共用监听、分阶段记录依赖。在读取前登记文件，即使文件缺失导致失败，也能在恢复时触发重新构建：

```ts
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    wxml: {
      validate: async (_code, ctx) => {
        ctx.addWatchFile('wxml-policy.json')
        const policy: unknown = JSON.parse(await readFile(resolve(ctx.root, 'wxml-policy.json'), 'utf8'))
        if (!Array.isArray(policy) || !policy.every(tag => typeof tag === 'string')) {
          throw new Error('wxml-policy.json 必须是禁用标签名的字符串数组')
        }
        const forbidden = new Set<string>(policy)
        await ctx.walk((node) => {
          if (forbidden.has(node.tagName)) {
            ctx.report({ severity: 'error', message: `不允许使用 ${node.tagName}`, location: node.location })
          }
        })
      },
    },
  },
})
```

`wxml-policy.json` 例如 `["debug-panel"]`。同一文件跨模板或阶段登记会去重；修改、删除、恢复触发完整模板重建与校验。局部构建保留未触及模板的依赖，成功完整构建清理失效登记。不要监听输出目录，也不要把一次读取的结果永久缓存而忽略规则更新。

“最终”指框架管理的输出链完成后的模板，不保证覆盖任意排在该阶段之后的第三方 Vite 插件修改。不保证跨文件／分包回调顺序，不追踪任意文件读取、环境变量或网络响应；第一版不提供内置业务规则、跨文件全局校验、独立 CLI 或报告文件，也不能替代宿主完整语法和运行时检查。


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

只删除特定标签上的特定属性，使用 `{ tag, name }` 规则：

```ts
export default defineConfig({
  weapp: {
    wxml: {
      remove: {
        attr: [
          { tag: 'view', name: 'data-testid' },
          { tag: 'my-card', name: ['role', 'aria-label'] },
        ],
      },
    },
  },
})
```

上述配置只删除 `view` 的 `data-testid` 和 `my-card` 的 `role`、`aria-label`。`text` 上的同名属性、`view` 的 `data-testid-extra`、标签及其子内容均保留；对象配置未设置 `comment`，因此普通注释也保留。

标签和属性名都针对最终模板匹配。全局字符串规则与标签限定规则取并集：如果同时加入 `'data-testid'`，所有标签上的该属性都会删除，后面的标签限定规则不能撤销它。

需要通配符、整节点或注释清理时，可显式组合：

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
  → transform：用户函数式转换
  → remove：属性、显式节点、普通注释
  → Tailwind / compiler-plugin → validate：最终模板校验
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

旧的 `weapp.wxml.removeComment` 和 `weapp.vue.template.removeComments` 保留公开类型并标记为弃用，以兼容已有 TypeScript 配置。它们延续原先未接入实际编译流程的行为，设置为 `true` 或 `false` 都不会控制注释清理，也不会影响新 `remove` 配置；它们不是兼容别名。请按原配置意图迁移：

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
