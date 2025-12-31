---
title: JSON：<json> 与宏
---

# JSON：`<json>` 与 Script Setup JSON 宏

## 本章你会学到什么

- 在 SFC 里如何写 `page.json/component.json/app.json`
- `<json>` 块与 `definePageJson/defineComponentJson` 的取舍

## 两种写法

### 1) `<json>` 块（静态配置更直观）

```vue
<json>
{
  "navigationBarTitleText": "示例页",
  "usingComponents": {
    "my-card": "/components/MyCard/index"
  }
}
</json>
```

### 2) Script Setup JSON 宏（适合拼装/复用）

```vue
<script setup lang="ts">
definePageJson(() => ({
  navigationBarTitleText: '示例页',
}))
</script>
```

## 合并规则与注意点

- 宏在构建期（Node.js）执行：不要依赖小程序运行时 API。
- 多次调用会 deep merge：后者覆盖前者。
- 宏通常具有更高优先级（用于覆盖 `<json>`）。

## 相关链接

- 详细说明与限制：`/guide/vue-sfc#script-setup-json-macros`
