<div align="center">
  <a href="https://vite.icebreaker.top">
    <img width="200" height="200" hspace="10" src="https://vite.icebreaker.top/logo.png" alt="vite logo" />
  </a>
  <h1>Weapp Vite</h1>
  <p>
    给小程序以现代化的开发体验
  </p>
  <img src="https://img.shields.io/node/v/weapp-vite" alt="node-current" />
  <img src="https://img.shields.io/npm/dependency-version/weapp-vite/peer/vite" alt="npm peer dependency version" />
  <img src="https://img.shields.io/github/v/release/weapp-vite/weapp-vite" alt="GitHub release" />
  <img src="https://img.shields.io/npm/l/weapp-vite" alt="licence" />
</div>

<p>&nbsp;</p>

## 使用文档地址: [vite.icebreaker.top](https://vite.icebreaker.top)

## Features

- 🚀 **Vue 3 支持**：完整的 Vue 单文件组件（SFC）支持，使用 Vue 官方编译器
  - `<script setup>` 和 TypeScript 完整支持
  - 完整的模板语法（v-if、v-for、v-model 等）
  - Scoped CSS 和 CSS Modules
  - 动态组件、过渡动画、KeepAlive
  - [详细文档 →](./test/vue/README.md)

- ⚡️ **Vite 构建**：带来了 `typescript` / `scss` / `less` 等等的原生支持
- 🔌 **插件生态**：Vite 插件生态支持，也可以自定义编写插件，方便扩展

## 快速开始

### Vue 项目

```typescript
import weappVite from '@weapp-vite/vite'
// vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    weappVite({
      vue: {
        enable: true,
        template: {
          removeComments: true,
        },
      },
    }),
  ],
})
```

```vue
<!-- App.vue -->
<script setup>
import { ref } from 'vue'

const message = ref('Hello Vue in Mini-program!')

function handleClick() {
  console.log('Button clicked!')
}
</script>

<template>
  <view class="container">
    <text>{{ message }}</text>
    <button @click="handleClick">
      Click
    </button>
  </view>
</template>

<style scoped>
.container {
  padding: 20rpx;
}
</style>
```

📚 **完整文档**: [Vue 支持文档](./test/vue/README.md)

## Contribute

我们邀请你来贡献和帮助改进 `weapp-vite` 💚💚💚

以下有几个方式可以参与:

- 报告错误：如果您遇到任何错误或问题，请提`issue`并提供完善的错误信息和复现方式。
- 建议：有增强 `weapp-vite` 的想法吗？请提 `issue` 来分享您的建议。
- 文档：如果您对文档有更好的见解或者更棒的修辞方式，欢迎 `pr`。
- 代码：任何人的代码都不是完美的，我们欢迎你通过 `pr` 给代码提供更好的质量与活力。

## License

[MIT](./LICENSE)

<!-- "//------":""esbuild": "^0.21.3",", -->
