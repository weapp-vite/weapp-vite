---
title: Wevu 编译期配置
description: 说明 weapp.wevu.defaults、preset 与 autoSetDataPick 的作用、默认行为和适用场景。
keywords:
  - 配置
  - config
  - wevu
  - defaults
  - preset
  - autoSetDataPick
---

# Wevu 编译期配置 {#wevu-config}

本页聚焦 `weapp.wevu` 这组“编译期注入 / 默认值治理”配置。它们主要影响：

- `app.vue` 编译时是否自动注入 `setWevuDefaults()`
- 组件 / 页面默认 `setData` 策略
- 是否自动从模板推导 `setData.pick`

> [!NOTE]
> 这里讨论的是 `weapp-vite` 在编译阶段帮你做什么，不是 `wevu` 运行时 API 的完整手册。运行时能力请继续阅读 [/wevu/runtime](/wevu/runtime)。

[[toc]]

## `weapp.wevu.defaults` {#weapp-wevu-defaults}
- **类型**：`WevuDefaults`
- **默认值**：`undefined`
- **作用**：在编译 `app.vue` 时自动注入 `setWevuDefaults()`，统一控制 Wevu 的 `createApp/defineComponent` 默认值。

### 配置示例

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    wevu: {
      defaults: {
        app: {
          setData: {
            includeComputed: false,
            strategy: 'patch',
          },
        },
        component: {
          options: {
            addGlobalClass: true,
          },
          setData: {
            strategy: 'patch',
          },
        },
      },
    },
  },
})
```

### 注意事项

- 仅对 `app.vue` 生效：Weapp-vite 会在编译产物中插入 `setWevuDefaults()`，并确保它在 `createApp()` 之前执行。
- 配置必须可序列化（JSON 兼容）：不支持函数、`Symbol`、循环引用。
- 局部显式配置会覆盖默认值；`setData` 与 `options` 会做浅合并，其余字段按对象顶层合并。
- 若你希望手动控制时机，可以在 `app.vue` 顶层显式调用 `setWevuDefaults()`，并关闭此配置以避免重复注入。
- 当 `app.vue`/组件导出为对象字面量时，Weapp-vite 会把默认值直接合并进编译产物，方便排查与调试；若导出是变量或函数，仍会回落到运行时合并。
- 若设置了 `component.options.virtualHost = true`，Weapp-vite 会在 **页面** 入口自动补上 `virtualHost: false`，避免页面虚拟节点导致的渲染层错误；需要为页面开启时请在页面内显式配置。

### 全局默认开启 `virtualHost: true`

微信官方文档里的 `virtualHost: true`，在 `weapp-vite` + `wevu` 里推荐通过 `weapp.wevu.defaults.component.options.virtualHost` 统一配置。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    wevu: {
      defaults: {
        component: {
          options: {
            virtualHost: true,
          },
        },
      },
    },
  },
})
```

这样做之后：

- 所有通过 Wevu 编译的**组件**默认都会带上 `options.virtualHost = true`
- **页面**不会继承这个默认值；Weapp-vite 会自动补成 `virtualHost: false`
- 某个组件如果显式写了自己的 `options.virtualHost`，以组件内声明为准

适合场景：

- 你希望项目里的大多数业务组件都走虚拟节点
- 你不想在每个组件里重复手写 `options: { virtualHost: true }`
- 你仍然希望页面保持安全默认值，避免误把页面也变成虚拟节点

### `virtualHost` 的覆盖规则

可以把优先级理解成：

1. 组件/页面文件里的显式配置
2. `weapp.wevu.defaults.component.options`
3. Wevu / Weapp-vite 内建默认值

最常见的结果是：

- 全局设了 `component.options.virtualHost = true` 后，组件默认开启
- 页面即使命中了同一套默认项，也会被编译器改写为 `virtualHost: false`
- 如果你真的要给某个页面开启，必须在页面内手动显式声明

## 手动开启 `virtualHost` 的几种方式 {#manual-virtualhost}

如果你不想全局开启，或者只想给少数组件/页面单独配置，可以直接在文件里手动声明。

### 方式 1：`<script setup>` + `defineComponentJson`

适合新增的 Wevu Vue SFC 组件：

```vue
<script setup lang="ts">
defineComponentJson(() => ({
  component: true,
  options: {
    virtualHost: true,
  },
}))
</script>
```

### 方式 2：`<script setup>` + `defineOptions`

适合你已经在组件里使用 `defineOptions()` 管原生组件选项：

```vue
<script setup lang="ts">
defineOptions({
  options: {
    virtualHost: true,
  },
})
</script>
```

### 方式 3：`defineComponent({ options })`

适合非 `<script setup>` 写法：

```ts
import { defineComponent } from 'wevu'

export default defineComponent({
  options: {
    virtualHost: true,
  },
  setup() {
    return {}
  },
})
```

### 方式 4：`<json>` 配置块

适合历史 SFC 或仍在用 `<json>` 的项目：

```vue
<json lang="jsonc">
{
  "component": true,
  "options": {
    "virtualHost": true
  }
}
</json>
```

### 方式 5：原生组件 `component.json`

适合不是 Wevu SFC、而是原生小程序组件目录：

```json
{
  "component": true,
  "options": {
    "virtualHost": true
  }
}
```

## FAQ

### Q: 能不能让全局组件默认都开启 `virtualHost: true`？

可以。直接配置 `weapp.wevu.defaults.component.options.virtualHost = true` 即可。

### Q: 全局开启后，会不会把页面也一起改成 `virtualHost: true`？

不会。Weapp-vite 会对页面自动回退成 `virtualHost: false`，避免页面误用虚拟节点。

### Q: 页面如果也想开启怎么办？

在页面文件里显式声明 `options.virtualHost = true`。页面内的手动配置优先级高于全局默认值。

### Q: 手动配置和全局默认同时存在时，谁生效？

以文件内显式配置为准；全局默认只负责“补默认值”，不会覆盖你在页面或组件里手写的 `options.virtualHost`。

> [!TIP]
> 如果你不通过 Weapp-vite 构建，也可以在运行时手动调用 `setWevuDefaults()`（见 [/wevu/runtime](/wevu/runtime)）。

## `weapp.wevu.preset` {#weapp-wevu-preset}
- **类型**：`'performance'`
- **默认值**：`undefined`
- **作用**：一键启用性能向默认项，降低 `setData` 快照与后台态更新带来的开销。

### 配置示例

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    wevu: {
      preset: 'performance',
    },
  },
})
```

### `performance` 预设内容

- 为 `app/component` 注入 `setData.strategy: 'patch'`。
- 为 `app/component` 注入 `setData.suspendWhenHidden: true`。
- 为 `app/component` 注入开发态高频告警：`setData.highFrequencyWarning = { enabled: true, devOnly: true }`。
- 默认启用 `autoSetDataPick`；若你显式设置 `autoSetDataPick: false`，则以显式配置为准。

### 覆盖规则

- 预设先应用，再与 `weapp.wevu.defaults` 做浅合并，`setData/options` 仍按字段浅合并。
- 你在 `weapp.wevu.defaults` 中写的同名字段，优先级高于预设默认值。

## `weapp.wevu.autoSetDataPick` {#weapp-wevu-auto-setdata-pick}
- **类型**：`boolean`
- **默认值**：`false`
- **作用**：在编译阶段从模板表达式自动提取渲染相关顶层 key，并注入到组件/页面的 `setData.pick`，减少非渲染字段参与快照与下发。

> [!IMPORTANT]
> 该能力默认关闭，不会在未配置时自动开启。只有显式设置 `weapp.wevu.autoSetDataPick: true` 才会生效。
> 从旧版本升级到新版本时，若你未手动开启该项，行为保持不变。
> 如果启用了 `weapp.wevu.preset: 'performance'`，则会默认开启该项，仍可通过显式 `false` 覆盖。

### 配置示例

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    wevu: {
      autoSetDataPick: true,
    },
  },
})
```

### 行为说明

- 仅对 `defineComponent/createWevuComponent` 产物生效，`app.vue` 不会注入。
- 若组件已显式声明 `setData.pick` 数组，会与自动推导结果做去重合并。
- 若 `setData` 为变量或表达式，例如 `setData: externalConfig`，会包裹为 `{ pick: [...], ...externalConfig }` 以保持兼容。
- 建议在“状态很大但模板只使用少量字段”的页面优先开启；若模板几乎使用全部字段，收益通常不明显。

### FAQ

#### Q: `autoSetDataPick` 默认会自动开启吗？
不会。默认值是 `false`，只有显式配置 `weapp.wevu.autoSetDataPick: true` 才会生效。

#### Q: 为什么我在 `app.vue` 里看不到注入结果？
这是预期行为。该能力仅对 `defineComponent/createWevuComponent` 产物生效，不会对 `app.vue` 注入 `setData.pick`。

#### Q: 我已经手写了 `setData.pick`，会被覆盖吗？
不会。自动推导结果会与已有 `setData.pick` 做去重合并，不会丢掉你手写的 key。

#### Q: 怎么快速确认它是否生效？
先执行一次构建，然后检查页面/组件产物 JS 中是否出现 `setData.pick`。若模板含调用表达式，通常也会看到 `__wv_bind_*` 被写入 `pick` 数组。

## 关联阅读

- [Vue SFC 配置](/config/vue.md)
- [TypeScript 支持文件](/config/typescript.md)
- [Wevu 运行时](/wevu/runtime)
