---
title: class/style 绑定能力
---

# class/style 绑定能力

`weapp-vite + wevu` 在小程序侧对齐 Vue 3 的 `:class` / `:style` 绑定语法，支持字符串、数组、对象与嵌套组合，并会输出小程序可识别的字符串 class/style。

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
