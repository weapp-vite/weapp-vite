## Vue 模板兼容矩阵

“兼容有说明”表示常见迁移结果一致，但最终执行的是小程序模板而不是浏览器 DOM。只要差异会改变写法、参数或渲染结果，就归入“Vue 差异”。

### 内置指令

#### `v-text` {#directive-v-text}

**兼容有说明。** 编译为小程序文本插值；不经过 DOM `textContent`。

#### `v-html` {#directive-v-html}

**不支持。** 编译器会给出警告并忽略该指令，请使用小程序 `rich-text` 组件渲染受信任节点数据。

#### `v-show` {#directive-v-show}

**兼容有说明。** 编译器把条件拼接到 `style` 的 `display`，节点不会因切换而销毁。

#### `v-if` {#directive-v-if}

**兼容有说明。** 转换为当前平台的条件渲染属性，例如微信的 `wx:if`。

#### `v-else-if` {#directive-v-else-if}

**兼容有说明。** 转换为当前平台的条件分支属性，并要求与前一条件节点保持合法相邻关系。

#### `v-else` {#directive-v-else}

**兼容有说明。** 转换为当前平台的兜底条件分支。

#### `v-for` {#directive-v-for}

**兼容有说明。** 转换为宿主列表指令；编译器会规范化 item、index 和 key，并为运行时表达式补充稳定索引。

#### `v-on` {#directive-v-on}

**Vue 差异。** `@click` 等事件会映射为小程序事件，例如 `tap`；事件修饰符只覆盖宿主可表达的语义。

#### `v-bind` {#directive-v-bind}

**Vue 差异。** 支持 `:prop="value"` 形式的显式绑定，当前不支持 `v-bind="object"` 属性展开。

#### `v-model` {#directive-v-model}

**Vue 差异。** 编译为小程序属性和赋值事件；目标必须是可赋值左值，表单类型、参数和修饰符支持范围见本页前文。

#### `v-slot` {#directive-v-slot}

**Vue 差异。** 普通插槽映射到小程序 slot；明确存在 slot props 的场景才会启用增强 scoped slot/generic 编译。

#### `v-pre` {#directive-v-pre}

**不支持。** 当前模板链路没有跳过局部编译的 Vue `v-pre` 语义。

#### `v-once` {#directive-v-once}

**Vue 差异。** 当前会产生支持不完整警告，并按普通节点继续渲染，不保证只渲染一次。

#### `v-memo` {#directive-v-memo}

**不支持。** 当前没有 Vue `v-memo` 的子树缓存和更新跳过语义。

#### `v-cloak` {#directive-v-cloak}

**Vue 差异。** 编译器忽略该标记；小程序没有浏览器首次编译前模板闪烁这一执行阶段。

#### 自定义指令 {#directive-custom}

**Vue 差异。** 自定义 `v-xxx` 会按小程序模板属性转换，不执行 Vue DOM 指令的 mounted/updated 等元素钩子。

### 特殊元素与内置组件

#### `<component>` {#element-component}

**Vue 差异。** 动态组件必须满足小程序 `usingComponents` 和模板动态组件能力，不能按浏览器运行时任意解析组件。

#### `<slot>` {#element-slot}

**Vue 差异。** 编译为小程序插槽；具名插槽转发会按平台选择 wrapper，避免真实运行时丢失内容。

#### `<template>` {#element-template}

**Vue 差异。** 搭配结构指令时转换为 `block`；带 `name/is/data` 时保留小程序原生 template 语义。

#### `<Transition>` {#element-transition}

**Vue 差异。** 当前仅渲染子节点并给出警告，不注入 Vue CSS/JavaScript 过渡运行时。

#### `<TransitionGroup>` {#element-transition-group}

**不支持。** 当前不提供列表过渡运行时。

#### `<KeepAlive>` {#element-keep-alive}

**Vue 差异。** 当前输出带标记的 `block`，不承诺 Vue 完整的组件实例缓存语义。

#### `<Teleport>` {#element-teleport}

**不支持。** 小程序模板没有 Vue Teleport 的任意目标挂载模型。

#### `<Suspense>` {#element-suspense}

**不支持。** 当前不提供 Vue Suspense 异步依赖边界。

#### `key` {#attribute-key}

**兼容有说明。** 用于稳定列表节点身份，并转换为当前小程序平台的 key 属性；不要依赖浏览器 VNode 的复用细节。

#### `ref` {#attribute-ref}

**Vue 差异。** 编译器登记小程序节点或组件引用，通过 `useTemplateRef()` 异步读取宿主查询结果，不返回 DOM Element。

#### `is` {#attribute-is}

**Vue 差异。** 动态组件受 `usingComponents` 与宿主动态组件能力限制；原生 `<template is="...">` 仍按小程序模板语义处理。

### HTML 标签转换 {#html-tag-mapping}

`weapp.vue.template.htmlTagToWxml` 默认启用以下映射。标签发生改名时，`htmlTagToWxmlTagClass` 默认还会保留原标签名 class，方便迁移 CSS；两项配置都只作用于 Vue SFC 模板。

| Vue 模板标签 | 小程序标签  | Vue 模板标签 | 小程序标签 |
| ------------ | ----------- | ------------ | ---------- |
| `a`          | `navigator` | `article`    | `view`     |
| `aside`      | `view`      | `b`          | `text`     |
| `blockquote` | `view`      | `br`         | `view`     |
| `button`     | `button`    | `code`       | `text`     |
| `dd`         | `view`      | `div`        | `view`     |
| `dl`         | `view`      | `dt`         | `view`     |
| `em`         | `text`      | `figcaption` | `view`     |
| `figure`     | `view`      | `footer`     | `view`     |
| `form`       | `form`      | `h1` - `h6`  | `view`     |
| `header`     | `view`      | `hr`         | `view`     |
| `i`          | `text`      | `img`        | `image`    |
| `input`      | `input`     | `label`      | `label`    |
| `li`         | `view`      | `main`       | `view`     |
| `nav`        | `view`      | `ol`         | `view`     |
| `p`          | `view`      | `pre`        | `view`     |
| `section`    | `view`      | `small`      | `text`     |
| `span`       | `text`      | `strong`     | `text`     |
| `textarea`   | `textarea`  | `u`          | `text`     |
| `ul`         | `view`      |              |            |

```ts
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    vue: {
      template: {
        htmlTagToWxml: { dialog: 'view' },
        htmlTagToWxmlTagClass: true,
      },
    },
  },
})
```
