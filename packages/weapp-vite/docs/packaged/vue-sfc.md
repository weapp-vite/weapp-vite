# Vue SFC

这个文档只覆盖 `weapp-vite` 下小程序 Vue SFC 的高频规则。

## 推荐基线

- 优先使用 `<script setup lang="ts">`
- 宿主页面配置用 `definePageJson`
- 组件配置用 `defineComponentJson`
- 页面元信息和 layout 用 `definePageMeta`
- 命名路由用 `definePage`

## 宏的职责划分

- `defineAppJson`：应用级 JSON
- `definePageJson`：页面级宿主 JSON
- `defineComponentJson`：组件级 JSON
- `definePageMeta`：页面元信息和 layout
- `definePage`：路由名称和业务 `meta`

这些宏可以在同一个页面中各自声明，职责不会合并：

```vue
<script setup lang="ts">
definePageMeta({ layout: 'default', custom: { section: 'orders' } })
definePage({ name: 'orders', meta: { title: '订单业务标签' } })
definePageJson({ navigationBarTitleText: '订单' })
</script>
```

`definePage()` 的规范写法是顶层直接使用全局宏；显式导入或使用别名时只能来自 `wevu/router`。它是编译期声明，不存在可动态调用的运行时实现，旧名 `definePageRoute` 不提供兼容别名。`definePage({ name, meta })` 参数中的 `meta.title` 和 `meta.layout` 都只是路由业务数据，不会替代 `definePageJson()` 的宿主标题或 `definePageMeta()` 的 layout。

## `v-model`

小程序编译场景下，`v-model` 目标应是可赋值表达式。

可行：

```vue
<input v-model="form.name" />
```

不可行：

```vue
<input v-model="x + y" />
```

## SFC 样式

微信目标稳定支持 `<style scoped>`、默认/命名 CSS Modules、`useCssModule()` 和 CSS `v-bind()`。CSS 变量会合并到所有模板根节点的 style，不覆盖用户已有 style；`:deep()`、`:global()`、`:slotted()` 只支持可安全映射到小程序选择器的形式。

```vue
<script setup lang="ts">
import { ref, useCssModule } from 'wevu'

const color = ref('red')
const classes = useCssModule('theme')
</script>

<template>
  <view :class="classes.card" style="padding: 8px" />
</template>

<style scoped module="theme">
.card {
  color: v-bind(color);
}
</style>
```

其他小程序平台使用相同编译实现，但在完成对应 IDE/真机验证前视为实验性。

支付宝不支持 Vue 默认生成的 scoped 属性选择器。构建时会将模板作用域标记同步追加为 class，并将样式中的对应属性选择器转换为 class 选择器；保留原始 data 属性、动态 class 和选择器优先级，样式热更新也经过同一转换。无需移除 `<style scoped>`。

## `usingComponents`

当你在页面或组件里需要显式注册原生小程序组件时，优先明确当前文件使用的 JSON 宏与配置来源，避免多个入口互相覆盖。

## i18n Behavior

启用 `weapp.i18n` 后，Vue/Wevu 页面或组件需要显式接入 Behavior：

```vue
<script setup lang="ts">
import { i18n } from 'weapp-vite/i18n'

defineOptions({ behaviors: [i18n.behavior] })
</script>

<template>
  <view>{{ t('common.greeting', { user }) }}</view>
</template>
```

编译器只保留当前配置的 i18n 直接调用；其他函数调用仍回退逻辑线程。完整限制见 `i18n.md`。

## HTML 标签迁移辅助

如果你把偏 Web 风格的模板迁到 `.vue`，可以优先关注这两个配置：

- `weapp.vue.template.htmlTagToWxml`
  把常见 HTML 标签映射为小程序内置标签。
- `weapp.vue.template.htmlTagToWxmlTagClass`
  默认开启。映射发生时，会再补一个原标签名 class，方便你自己用 CSS 恢复默认外观。
- `weapp.vue.template.formatWxml`
  默认 `auto`。开发态会格式化生成的 WXML，生产构建保持紧凑输出；也可以显式设置 `true` 或 `false`。

例如：

```vue
<template>
  <h3 class="title">
    标题
  </h3>
  <br>
</template>
```

启用默认行为后，会得到类似：

```wxml
<view class="h3 title">标题</view>
<view class="br" />
```

## 原生插槽与 `provide` / `inject`

`weapp.vue.template.scopedSlotsRequireProps` 默认 `false`，普通插槽仍使用增强方案。设为 `true` 时，无 scoped props 的内容保留原生 `<slot>`。

微信目标下，编译后的 Wevu Provider 和 Leaf 使用默认 `setupLifecycle: 'attached'` 时，`<Provider><Leaf /></Provider>` 中的 Leaf 会在 setup 前同步关联最近的插槽承载者。Leaf 的 `inject()` 能取得 Provider 提供的原始对象、ref 和方法；点击调用 action 会更新双方共享状态。具名、普通节点包裹、嵌套和多实例场景遵循同一规则，卸载重建不会沿用旧上下文。

这条协议不新增包装节点，不复制注入值，不修改原生 `Component.export` / `selectOwnerComponent()`。显式 `setupLifecycle: 'created'` 或 attached 前的公开实例恢复仍按原时机执行 setup，不提供该保证；未经 Wevu 编译的原生/第三方组件也不自动成为注入承载者。

内层 Wevu Provider 即使使用过滤后的 `export()` / `expose()`，其普通模板子组件（含 Options API 局部注册别名）和原生插槽子组件仍共享内层上下文；外部选择器只看到该 Provider 的公开导出，内部父链不依赖公开导出对象。

已验证环境：微信 DevTools Stable `2.02.2608080`（基础库 `3.17.2`、`3.13.2`）和 `2.02.2608060`（基础库 `3.17.2`），并保留 mpcore 回归；这些结果不代替其他版本组合或真机验证。其他小程序平台及 Web 目标不启用此协议，构建时裁剪其声明属性、事件接收与清理代码，不能由微信或 headless 结果推断支持。`false` / augmented 和实际 scoped props 继续使用既有增强插槽路径。

## 具名插槽透传 wrapper

当你把当前组件的 `<slot />` 转发到子组件的具名插槽时：

```vue
<IssueCard>
  <template #header>
    <slot />
  </template>
</IssueCard>
```

编译器会使用真实节点 wrapper，默认类似：

```wxml
<view slot="header">
  <slot />
</view>
```

不要改成 `<block slot="header"><slot /></block>`。真实 WeChat DevTools 运行时里，这种写法会出现宿主 header，但转发内容不会渲染。

如果需要自定义 wrapper，可以在组件使用处写静态属性。组件内配置推荐使用普通 kebab-case 静态属性，避免和 Vue 指令参数语法混淆。

`slot-wrapper` 是当前组件所有普通具名插槽的默认 wrapper：

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

`slot-wrapper-<slotName>` 只覆盖指定具名插槽；单个 slot 的覆盖更推荐直接写在对应的 `<template #xxx>` 上：

```vue
<template>
  <IssueCard slot-wrapper="cover-view">
    <template #header>
      <slot />
    </template>
    <template #footer slot-wrapper="view">
      <slot name="footer" />
    </template>
  </IssueCard>
</template>
```

产物中 `header` 使用 `slot-wrapper="cover-view"`，`footer` 在对应的 `<template #footer>` 上覆盖：

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

只覆盖单个 slot 时，更推荐把配置写在对应的 `<template #xxx>` 上。这个写法最靠近 slot 内容，优先级高于父组件标签上的默认值和 `slot-wrapper-<slotName>`：

```vue
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
```

产物：

```wxml
<IssueCard>
  <text slot="header" class="slot-header">
    <slot />
  </text>
  <cover-view slot="footer">
    <slot name="footer" />
  </cover-view>
</IssueCard>
```

在 `<template #header>` 上配置时，属性仍写 `slot-wrapper` / `slot-wrapper-class` / `slot-wrapper-style` / `slot-single-root-no-wrapper`，不需要再带 `header` 后缀。

也可以把 class/style 加到生成的 wrapper 上，而不是加到组件本身：

```vue
<template>
  <IssueCard slot-wrapper="cover-view">
    <template #header slot-wrapper="cover-view" slot-wrapper-class="slot-default" slot-wrapper-style="padding: 8px">
      <slot />
    </template>
    <template
      #footer
      slot-wrapper="view"
      slot-wrapper-class="slot-footer"
      slot-wrapper-style="margin-top: 12px"
    >
      <slot name="footer" />
    </template>
  </IssueCard>
</template>
```

产物：

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

动态绑定也支持，例如父组件标签上的 `:slot-wrapper-class="headerClass"` / `:slot-wrapper-style="headerStyle"`，以及 `<template #footer :slot-wrapper-class="footerClass">` 这种单 slot 就近覆盖。

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

这个下推策略不适用于转发 `<slot />`。微信平台默认会使用内部 `virtualHost` wrapper：

```vue
<template>
  <IssueCard slot-single-root-no-wrapper-header>
    <template #header>
      <slot />
    </template>
  </IssueCard>
</template>
```

```wxml
<IssueCard>
  <weapp-slot-wrapper slot="header">
    <slot />
  </weapp-slot-wrapper>
</IssueCard>
```

如果需要回到旧版 `view` wrapper，可配置 `weapp.vue.template.slotFallbackWrapperStrategy: 'view'`，或显式配置 `slotFallbackWrapper: 'view'`。

默认策略不会使用 `block`。如果显式配置 `slotFallbackWrapper: 'block'`，编译器会按原样输出：

```wxml
<IssueCard>
  <block slot="header">
    <slot />
  </block>
</IssueCard>
```

注意：`block` 在转发 `<slot />` 的部分 WeChat DevTools 运行时场景中会丢失内容，因此不作为默认值。显式启用时需要自行确认目标运行时和具体插槽内容可用。

你选择的 wrapper 必须能承载实际内容。比如下面的写法会让 `text` 包裹 `view`，这不适合真实运行时：

```vue
<template>
  <IssueCard>
    <template #header slot-wrapper="text">
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

也可以通过 `weapp.vue.template.slotFallbackWrapper` 全局配置，按组件和具名插槽匹配。显式配置 `slotFallbackWrapper` 后会优先于默认 `virtualHost` 策略。`rules[].component` 匹配使用处模板标签名；`rules[].componentName` 匹配子组件里的静态 `defineOptions({ name: 'HelloWorld' })`。`componentName` 需要编译器能解析到被引用的 Vue SFC，原生小程序组件继续用 `component`。

## 何时继续看其他文档

- 需要更完整的编辑器提示说明：[`../volar.md`](../volar.md)
- 需要运行时页面/组件/store 约束：[`wevu-authoring.md`](./wevu-authoring.md)
- 需要项目级 `weapp` 配置：[`weapp-config.md`](./weapp-config.md)


## JSON 合并读取页面声明

`weapp.json.mergeStrategy(target, source, ctx)` 可读取当前 SFC 页面的 `ctx.routeConfig`（`definePage` 的静态 `{ name, meta }`）和 `ctx.pageMeta`（`definePageMeta` 的完整静态对象）。元信息支持内联、外部脚本与规范导入别名，并贯穿编译阶段、`emit`、`merge-existing` 和 JSON-only HMR。

可按 `typeof ctx.routeConfig?.meta?.title === 'string'` 映射 `navigationBarTitleText`。`pageMeta` 含动态变量、调用、展开或访问器时整个字段为 `undefined`；编译器不会执行表达式或返回部分对象。无声明以及非页面组件不提供这些字段。已有非法路由声明诊断保持有效。
