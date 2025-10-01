# vite-plugin-performance

[中文文档](./README.zh-CN.md)

`vite-plugin-performance` wraps one or more Vite plugins and measures how long each lifecycle hook takes. It keeps the original behaviour intact while giving you actionable performance insights.

## ✨ Features

- Wrap a single plugin or an array of plugins with one call
- Ship with a sensible default hook list, or use `hooks: 'all'` to cover every function hook
- Threshold-based reporting so you only see the hooks that really hurt
- Pluggable logger, formatter, and lifecycle callback for easy monitoring integration
- Works with asynchronous hooks and still handles errors gracefully

## 📦 Installation

```bash
pnpm add -D vite-plugin-performance
# or npm / yarn / bun
```

## 🚀 Quick Start

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

Whenever a hook crosses the threshold (default `0` ms) you will see output similar to:

```
[inspect] transform            ⏱   78.42 ms
```

## ⚙️ Options

| Option            | Type                         | Default                           | Description                                                               |
| ----------------- | ---------------------------- | --------------------------------- | ------------------------------------------------------------------------- |
| `hooks`           | `PluginHookName[] \| 'all'`  | `DEFAULT_PLUGIN_HOOKS`            | Choose which hooks to wrap; pass `'all'` to wrap every function hook      |
| `threshold`       | `number`                     | `0`                               | Only hooks with a duration greater or equal to the threshold are reported |
| `silent`          | `boolean`                    | `false`                           | Disable the built-in logger                                               |
| `logger`          | `(message, context) => void` | `console.log`                     | Custom log writer                                                         |
| `formatter`       | `(context) => string`        | `[plugin] transform ⏱  12.34 ms` | Custom message formatter                                                  |
| `onHookExecution` | `(context) => void`          | `undefined`                       | Callback invoked after a hook finishes                                    |
| `clock`           | `() => number`               | `performance.now` or `Date.now`   | High-resolution timer, handy for tests                                    |

> The legacy misspelled option `slient` is still recognised and mapped to `silent`.

### Default Hook List

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

## 🧠 Advanced Usage

### Wrap Multiple Plugins

```ts
const pluginA = ...
const pluginB = ...

export default defineConfig({
  plugins: wrapPlugin([pluginA, pluginB], { threshold: 20 }),
})
```

### Custom Log Format

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

### Limit to Specific Hooks

```ts
wrapPlugin(plugin, {
  hooks: ['resolveId', 'load', 'transform'],
})
```

## 🧪 Testing

```bash
pnpm --filter vite-plugin-performance test
```

## 📄 License

MIT
