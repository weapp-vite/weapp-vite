# Weapp Config

## 入口位置

`weapp-vite` 的小程序配置通常放在：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
  },
})
```

## 高频配置项

### `srcRoot`

源码根目录。排查输出缺页、找不到入口、自动路由异常时先确认它。

### `autoRoutes`

适合希望用约定生成页面路由的项目。启用后要保持 pages 目录与输出约定稳定。

### `buildScope`

用于只构建主包和指定分包。常用在大项目里只调试某几个业务分包：

```bash
wv dev --scope main,packages/order
wv build --scope packages/order
```

也可以写在配置里：

```ts
export default defineConfig({
  weapp: {
    buildScope: {
      includeMainPackage: true,
      include: ['packages/order'],
    },
  },
})
```

`main` 表示主包，`packages/order` 匹配 `app.json.subPackages[].root`。启用后，产物 `app.json.subPackages` 只保留参与 scope 的分包，`preloadRule`、自动路由和 typed router 也会按同一范围裁剪。发布前建议再跑不带 scope 的完整构建。

### `autoImportComponents`

适合用目录扫描自动注册组件的项目。组件重名时要先解决命名冲突，不要让自动引入规则长期处于歧义状态。

### `routeRules`

用于给页面路由追加规则，例如 layout、运行时行为等。它属于项目级编排，而不是组件内部语义。

### `vue.template.htmlTagToWxml`

适合从 Web/Vue 模板迁移到小程序 `.vue` 的项目。开启后，会把常见 HTML 标签映射成小程序内置标签，例如 `div -> view`、`span -> text`、`img -> image`、`a -> navigator`，也包含 `br/hr` 这类容易在迁移时“消失”的标签。

### `vue.template.htmlTagToWxmlTagClass`

默认开启。仅当 `htmlTagToWxml` 发生标签映射时，为输出节点追加原标签名 class，例如 `h3 -> <view class="h3">`、`br -> <view class="br" />`。

如果你的迁移策略是“先跑通，再用 CSS 逐步恢复默认外观”，这个开关很有价值；如果不希望产物里自动带这层语义 class，可以显式设为 `false`。

### `vue.template.formatWxml`

控制 `.vue` / JSX 编译生成的 WXML 是否格式化。默认 `auto`：开发态开启，生产构建关闭。显式设为 `true` 可始终输出带缩进和换行的 WXML，显式设为 `false` 可始终保持紧凑输出。

格式化只处理标签层级缩进，含文本内容的元素会保持单行，避免重排文本空白语义。

### `vue.template.slotFallbackWrapper`

用于配置普通具名插槽 fallback 的真实 wrapper。默认是 `view`。

当组件把自己的默认 `<slot />` 继续透传到子组件的具名插槽时，编译器不能生成 `<slot slot="header" />`，也不能稳定使用 `<block slot="header"><slot /></block>`。真实 WeChat DevTools 运行时中，`block` 路径会丢失转发内容。因此默认产物是：

```wxml
<view slot="header">
  <slot />
</view>
```

全局配置示例：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    vue: {
      template: {
        slotFallbackWrapper: {
          tag: 'view',
          attrs: {
            class: 'slot-wrapper',
          },
          rules: [
            { component: 'IssueCard', slot: 'header', tag: 'cover-view' },
            { componentName: 'HelloWorld', slot: 'header', tag: 'cover-view' },
            { component: 'IssueCard', slot: 'footer', attrs: { class: 'slot-footer' } },
            { component: /^Van/, slot: ['title', 'label'], tag: 'view' },
          ],
        },
      },
    },
  },
})
```

`component` 匹配使用处模板标签名，例如 `<IssueCard>` 对应 `IssueCard`，`<issue-card>` 对应 `issue-card`。如果要按子组件自己的名字匹配，让子组件写静态 `defineOptions({ name: 'HelloWorld' })`，然后使用 `componentName: 'HelloWorld'`。`componentName` 需要编译器能解析到被引用的 Vue SFC；原生小程序组件或第三方小程序组件继续用 `component`。

组件内也可以用静态属性覆盖。`slot-wrapper` 是当前组件所有普通具名插槽的默认 wrapper：

```vue
<template>
  <IssueCard slot-wrapper="cover-view">
    <template #header>
      <slot />
    </template>
    <template #footer>
      <slot name="footer" />
    </template>
  </IssueCard>
</template>
```

产物：

```wxml
<IssueCard>
  <cover-view slot="header">
    <slot />
  </cover-view>
  <cover-view slot="footer">
    <slot name="footer" />
  </cover-view>
</IssueCard>
```

`slot-wrapper-<slotName>` 覆盖指定具名插槽。例如 `slot-wrapper-footer` 只覆盖 `footer`：

```vue
<template>
  <IssueCard slot-wrapper="cover-view" slot-wrapper-footer="view">
    <template #header>
      <slot />
    </template>
    <template #footer>
      <slot name="footer" />
    </template>
  </IssueCard>
</template>
```

产物：

```wxml
<IssueCard>
  <cover-view slot="header">
    <slot />
  </cover-view>
  <view slot="footer">
    <slot name="footer" />
  </view>
</IssueCard>
```

也可以把单个 slot 的覆盖配置写在对应的 `<template #xxx>` 上：

```vue
<!-- eslint-disable vue/no-useless-template-attributes -->
<template>
  <IssueCard slot-wrapper="cover-view">
    <template #header slot-wrapper="text" slot-wrapper-class="slot-header">
      <slot />
    </template>
    <template #footer>
      <slot name="footer" />
    </template>
  </IssueCard>
</template>
<!-- eslint-enable vue/no-useless-template-attributes -->
```

`<template #header>` 上的 `slot-wrapper` / `slot-wrapper-class` / `slot-wrapper-style` / `slot-single-root-no-wrapper` 是该 slot 的就近覆盖，优先级高于父组件标签上的默认值和 `slot-wrapper-header`。

组件内还可以把 class/style 加到生成的 wrapper 上：

```vue
<template>
  <IssueCard
    slot-wrapper="cover-view"
    slot-wrapper-class="slot-default"
    slot-wrapper-style="padding: 8px"
    slot-wrapper-footer="view"
    slot-wrapper-footer-class="slot-footer"
    slot-wrapper-footer-style="margin-top: 12px"
  >
    <template #header>
      <slot />
    </template>
    <template #footer>
      <slot name="footer" />
    </template>
  </IssueCard>
</template>
```

```wxml
<IssueCard>
  <cover-view slot="header" class="slot-default" style="padding: 8px">
    <slot />
  </cover-view>
  <view slot="footer" class="slot-footer" style="margin-top: 12px">
    <slot name="footer" />
  </view>
</IssueCard>
```

也支持 `:slot-wrapper-class="headerClass"`、`:slot-wrapper-style="headerStyle"`、`:slot-wrapper-footer-class="footerClass"` 这类动态绑定，但参数名必须是静态的。

`slot-single-root-no-wrapper-<slotName>` 可以让指定插槽在单根真实节点场景下尽量下推 `slot="..."`：

```vue
<template>
  <IssueCard slot-single-root-no-wrapper-icon>
    <template #icon>
      <image src="/assets/icon.png" />
    </template>
  </IssueCard>
</template>
```

产物：

```wxml
<IssueCard>
  <image slot="icon" src="/assets/icon.png" />
</IssueCard>
```

如果插槽内容是转发 `<slot />`，即使配置了 `slot-single-root-no-wrapper-header`，仍会保留 wrapper：

```wxml
<IssueCard>
  <view slot="header">
    <slot />
  </view>
</IssueCard>
```

`block` 不允许作为 wrapper，会回退到 `view` 并输出 warning。自定义 wrapper 必须是目标小程序运行时可渲染、并且能承载当前 slot 内容的真实节点或组件。例如下面的写法会生成 `text` 包裹 `view`，这不适合真实运行时：

```vue
<template>
  <IssueCard slot-wrapper-header="text">
    <template #header>
      <view>Header</view>
    </template>
  </IssueCard>
</template>
```

```wxml
<IssueCard>
  <text slot="header">
    <view>Header</view>
  </text>
</IssueCard>
```

### `layout`

页面 layout 既可能来自项目级规则，也可能来自页面侧 `definePageMeta`。排查时先确认是哪一层生效。

### `chunks.sharedStrategy`

常见策略：

- `duplicate`：偏向分包首开性能
- `hoist`：偏向共享抽取与包体控制

不要在 `srcRoot`、路由来源、分包边界都没确认前就先调 chunk 策略。

### `hmr.logLevel` / `hmr.profileJson`

排查开发态热更新慢、共享 chunk 回退或 DevTools 热重载不稳定时，可以临时打开：

```ts
export default defineConfig({
  weapp: {
    hmr: {
      logLevel: 'concise',
      profileJson: '.tmp/weapp-vite-hmr-profile.jsonl',
    },
  },
})
```

- `logLevel: 'default' | 'concise' | 'verbose'` 控制终端诊断详细程度。
- `profileJson: boolean | string` 控制是否输出 JSONL profile，字符串表示自定义输出路径。

### `mcp`

`weapp.mcp` 默认启用，但默认不自动启动服务。AI 客户端接入优先走 CLI：

```bash
wv mcp init codex
wv mcp print codex
wv mcp doctor codex
```

## CLI 与 IDE 命令

`weapp-vite` 原生命令优先，IDE 相关命令通过 `weapp-ide-cli` 透传。

例如：

```bash
weapp-vite build
weapp-vite preview --project ./dist/build/mp-weixin
weapp-vite ide preview --project ./dist/build/mp-weixin
```

## 继续阅读

- 项目结构与 `AGENTS.md`：[`project-structure.md`](./project-structure.md)
- wevu 运行时写法：[`wevu-authoring.md`](./wevu-authoring.md)
- Vue SFC 宏与模板：[`vue-sfc.md`](./vue-sfc.md)
