---
title: class/style 绑定能力
description: Weapp-vite + Wevu 在小程序侧对齐 Vue 3 的 :class / :style
  绑定语法，支持字符串、数组、对象与嵌套组合，并会输出小程序可识别的字符串 class/style。
keywords:
  - Wevu
  - 运行时
  - vue
  - sfc
  - class
  - style
  - class/style
  - 绑定能力
---

# class/style 绑定能力

`weapp-vite + Wevu` 在小程序侧对齐 Vue 3 的 `:class` / `:style` 绑定语法，支持字符串、数组、对象与嵌套组合，并会输出小程序可识别的字符串 class/style。

## SFC 样式能力

- `<style scoped>` 使用基于项目相对路径的稳定 scope 属性，同时注入到当前 SFC 的多个模板根节点。
- `<style module>` 暴露默认 `$style`，`<style module="theme">` 暴露命名 `theme`；两者都可在模板或同步 setup 中使用。
- CSS `v-bind(expression)` 由 compiler-sfc 改写为自定义属性，Wevu 把响应式结果合并到每个模板根节点的 style，不覆盖已有静态或动态 style。
- `:deep()`、`:global()`、`:slotted()` 经过 PostCSS selector AST 转换；无法安全映射到小程序选择器的写法会在编译期报错。

微信目标为稳定支持。其他小程序平台复用同一编译结果，但在取得对应 IDE/真机证据前保持实验性。

## `useCssModule()` {#usecssmodule}

在带有 `<style module>` 或命名 module 的 SFC 中，`useCssModule(name = '$style')` 可在同步 `setup()` 读取类名映射。名称不存在时会抛出确定性错误，避免模板静默得到空 class。

```vue
<script setup lang="ts">
import { useCssModule } from 'wevu'

const classes = useCssModule()
</script>

<template>
  <view :class="classes.card" />
</template>

<style module>
.card {
  display: flex;
}
</style>
```

```vue
<template>
  <view
    v-show="visible"
    class="card base"
    :class="[active && 'active', { highlight, disabled: !ok }, extra]"
    :style="[
      { color: themeColor, fontSize: `${size}px` },
      { '--gap': gap },
      inlineStyle,
    ]"
  />
</template>
```

## 运行时模式

`class/style` 的运行时有两种实现，默认使用 JS：

- **WXS 运行时**：编译产物中注入 `__weapp_vite.cls/style` helper（WXS 文件），模板中调用 `__weapp_vite.cls()` / `__weapp_vite.style()`。
- **JS 运行时**：编译期注入 `computed`，在逻辑层计算字符串 class/style。

配置项：

```ts
// weapp-vite.config.ts
export default defineConfig({
  weapp: {
    vue: {
      template: {
        classStyleRuntime: 'js', // 'auto' | 'wxs' | 'js'
        classStyleWxsShared: true, // 是否复用 WXS helper
      },
    },
  },
})
```

默认 `js` 会在逻辑层注入 `computed` 来计算 class/style 字符串。

若配置为 `auto`，会在平台支持 WXS（`weapp.wxs !== false` 且 `outputExtensions.wxs` 存在）时启用 WXS，否则回退到 JS。若手动指定 `wxs` 但平台不支持，会回退到 JS 并输出中文告警。

`classStyleWxsShared` 默认开启：主包与非独立分包共享一份 `__weapp_vite_class_style.wxs`，独立分包会各自生成一份。关闭后会按页面目录生成，方便手动控制拷贝或排查问题。

## 实现细节与限制

- **v-show 拼接**：`v-show` 会被拼接到 style（`display: none`），与 Vue 行为一致。
- **v-for 下 index 注入**：JS 运行时需要稳定索引，若模板未提供 `index`，编译器会自动注入 `wx:for-index="__wv_index_N"`。
- **对象 v-for**：JS 运行时会按 `Object.keys` 枚举顺序生成映射结果，确保索引与渲染一致。
- **表达式安全**：不使用 `eval/new Function/with`。表达式由编译器解析并重写标识符（包括作用域插槽 `__wvOwner` / `__wvSlotPropsData`），解析失败会输出中文告警并回退为空字符串。

> 建议：优先保持表达式为可解析的 JS/TS 表达式，避免非常规语法或依赖运行时动态生成的表达式字符串。
