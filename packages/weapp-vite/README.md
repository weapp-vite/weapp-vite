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
- 🧰 **IDE 命令增强**：可直接透传 `weapp-ide-cli` 全量命令（`preview/upload/config/automator` 等）

## 快速开始

### Vue 项目

```typescript
// vite.config.ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    vue: {
      enable: true,
      template: {
        removeComments: true,
      },
    },
  },
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

- 配置智能提示文档：[docs/volar.md](./docs/volar.md)
- defineConfig 重载说明：[docs/define-config-overloads.md](./docs/define-config-overloads.md)
- MCP 集成使用指南：[docs/mcp.md](./docs/mcp.md)

## CLI 中调用 weapp-ide-cli

`weapp-vite` 内置了对 `weapp-ide-cli` 的透传能力，除了 `dev/build/open/init/generate/analyze/npm` 等原生命令外，其它 IDE 相关命令都可以直接调用：

```sh
weapp-vite preview --project ./dist/build/mp-weixin
weapp-vite upload --project ./dist/build/mp-weixin -v 1.0.0 -d "release"
weapp-vite config lang zh
weapp-vite navigate pages/index/index --project ./dist/build/mp-weixin
```

也支持命名空间写法：

```sh
weapp-vite ide preview --project ./dist/build/mp-weixin
weapp-vite ide config show
```

## CLI 启动 MCP

`weapp-vite` 已集成 `@weapp-vite/mcp`，可直接启动 MCP Server：

```sh
weapp-vite mcp
```

指定工作区根路径：

```sh
weapp-vite mcp --workspace-root /absolute/path/to/weapp-vite
```

详细说明见：[docs/mcp.md](./docs/mcp.md)

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
