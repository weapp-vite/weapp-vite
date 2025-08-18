# 使用 TS/JS 生成 JSON

为了提升 `json` 文件的复用性， `weapp-vite` 除了支持最原始的 `json/jsonc` 之外，还支持以 `json.ts` 和 `json.js` 为后缀的文件格式

比如一个组件为 `custom.wxml`，就会去目录下，依次寻找 `custom.json.ts`, `custom.json.js`, `custom.jsonc.js`, `custom.json`

::: tip
目前配置文件加载的优先级为: `jsonc` > `json` > `json.ts` > `json.js` !
:::

## 使用示例

我们来看看怎么使用，以组件为例:

::: code-group

```json [navigation-bar.json]
{
  "component": true,
  "styleIsolation": "apply-shared",
  "usingComponents": {}
}
```

```ts [navigation-bar.ts]
import { defineComponentJson } from 'weapp-vite/json'

export default defineComponentJson(
  {
    component: true,
    styleIsolation: 'apply-shared',
    usingComponents: {},
  },
)
```

```js [navigation-bar.js]
import { defineComponentJson } from 'weapp-vite/json'

export default defineComponentJson(
  {
    component: true,
    styleIsolation: 'apply-shared',
    usingComponents: {},
  },
)
```

:::

像这种方法还有很多:

<<< @/snippets/export-json.ts

对应分别生成: `app.json`, `component.json`, `page.json`, `sitemap.json`,`theme.json`

:::tip
注意，从 `weapp-vite/json` 里导出的 `defineXXX` 方法，只用来提供基本的智能提示，不会对你的配置做任何的修改，

所以即使是使用 `defineComponentJson`，你也不能够省略 `component: true,`

不过，你其实可以定义自己的 `defineCustomComponentJson` 来做选项的合并
:::

## 类型

在 `weapp-vite/json` 里还定义了许多的类型，帮助你进行类型的定义:

<<< @/snippets/export-json-type.ts

所以在上面那个示例中，假如你使用 `ts` / `js`，你还可以使用 `type` 类型声明 / `jsdoc` 的方式来获得智能提示

::: code-group

```ts [navigation-bar.ts]
import type { Component } from 'weapp-vite/json'

export default <Component>{
  component: true,
  styleIsolation: 'apply-shared',
  usingComponents: {},
}
```

```js [navigation-bar.js]
/**
 * @type {import('weapp-vite/json').Component}
 */
export default {
  component: true,
  styleIsolation: 'apply-shared',
  usingComponents: {},
}
```

:::

## 复用逻辑

我们直接上代码！

```ts
import type { Page } from 'weapp-vite/json'
import shared0 from '@/assets/shared.config.ts'
import shared1 from './shared.json.ts'

export default <Page>{
  usingComponents: {
    't-button': 'tdesign-miniprogram/button/button',
    't-divider': 'tdesign-miniprogram/divider/divider',
    'ice-avatar': '@/avatar/avatar',
  },
  ...shared0,
  ...shared1,
}
```

最终几个配置会进行合并，然后生成最终的 `json`

注意 `@/assets/shared.config.ts`，也就是说，这里是可以使用 `alias` 的

而这个的配置，会自动读取你目录下 `tsconfig.json` 的 `baseUrl` 和 `paths` 字段
