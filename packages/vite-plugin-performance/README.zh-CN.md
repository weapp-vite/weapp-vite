# vite-plugin-performance

[English Documentation](./README.md)

一个用于包裹 Vite 插件、统计生命周期钩子耗时的小工具，帮助你快速定位构建链路中的性能瓶颈。插件原有行为保持不变，我们只在钩子执行完成后采集数据并按需输出或上报。

## ✨ 特性

- 支持同时包裹单个插件或插件数组
- 内置常用钩子列表，可设置 `hooks: 'all'` 包裹所有函数钩子
- 阈值过滤机制，只关注真正慢的钩子
- 自定义日志、格式化与回调，方便接入监控体系
- 兼容异步钩子，异常也会统计耗时

## 📦 安装

```bash
pnpm add -D vite-plugin-performance
# 或 npm / yarn / bun
```

## 🚀 快速上手

```ts
import { defineConfig } from 'vite'
import Inspect from 'vite-plugin-inspect'
import { wrapPlugin } from 'vite-plugin-performance'

export default defineConfig({
  plugins: [
    wrapPlugin(Inspect(), {
      threshold: 50,
      onHookExecution({ pluginName, hookName, duration }) {
        reportToAPM({ pluginName, hookName, duration })
      },
    }),
  ],
})
```

当某个钩子耗时超过设置的阈值（默认 0 ms）时，控制台会输出：

```
[inspect] transform            ⏱   78.42 ms
```

## ⚙️ 选项

| 选项              | 类型                         | 默认值                            | 说明                                          |
| ----------------- | ---------------------------- | --------------------------------- | --------------------------------------------- |
| `hooks`           | `PluginHookName[] \| 'all'`  | `DEFAULT_PLUGIN_HOOKS`            | 指定需要包裹的钩子；传 `all` 包裹所有函数钩子 |
| `threshold`       | `number`                     | `0`                               | 只有耗时大于等于该值的钩子才会被记录          |
| `silent`          | `boolean`                    | `false`                           | 关闭内置日志输出                              |
| `logger`          | `(message, context) => void` | `console.log`                     | 自定义日志输出函数                            |
| `formatter`       | `(context) => string`        | `[plugin] transform ⏱  12.34 ms` | 自定义日志内容格式                            |
| `onHookExecution` | `(context) => void`          | `undefined`                       | 钩子执行完毕后触发，可用于上报                |
| `clock`           | `() => number`               | `performance.now` 或 `Date.now`   | 高精度计时器，便于测试或自定义时间源          |

> 兼容早期误拼写的 `slient` 选项，会自动映射为 `silent`。

### 默认钩子列表

```ts
import { DEFAULT_PLUGIN_HOOKS } from 'vite-plugin-performance'
// [
//   'options',
//   'config',
//   'configResolved',
//   'configureServer',
//   'buildStart',
//   'resolveId',
//   'load',
//   'transform',
//   'buildEnd',
//   'generateBundle',
//   'renderChunk',
//   'writeBundle',
// ]
```

## 🧠 进阶用法

### 包裹多个插件

```ts
const pluginA = ...
const pluginB = ...

export default defineConfig({
  plugins: wrapPlugin([pluginA, pluginB], { threshold: 20 }),
})
```

### 自定义日志格式

```ts
wrapPlugin(plugin, {
  formatter({ pluginName, hookName, duration }) {
    return `${pluginName}:${hookName} took ${duration}ms`
  },
  logger(message) {
    myLogger.info(message)
  },
})
```

### 仅关注特定钩子

```ts
wrapPlugin(plugin, {
  hooks: ['resolveId', 'load', 'transform'],
})
```

## 🧪 测试

```bash
pnpm --filter vite-plugin-performance test
```

## 📄 许可

MIT
