# `wrapPlugin` – Vite Plugin Performance Wrapper

`wrapPlugin` is a utility function designed to wrap Vite plugins and monitor the execution time of their lifecycle hooks. It helps developers gain insights into plugin performance and identify potential bottlenecks.

---

## ✨ Features

- Automatically wraps and times specified Vite plugin hooks
- Supports threshold-based logging (only logs slow hooks)
- Allows custom hook selection
- Provides a callback for custom performance tracking
- Array merge support with override using `defu`

---

## 📦 Installation

```sh
npm i -D vite-plugin-performance
```

---

## 🚀 Usage

```ts
import someVitePlugin from 'some-vite-plugin'
import { defineConfig } from 'vite'
import { wrapPlugin } from 'vite-plugin-performance'

export default defineConfig({
  plugins: [
    wrapPlugin(
      someVitePlugin(),
      {
        threshold: 50, // Log only hooks taking longer than 50ms
        onHookExecution: ({ pluginName, hookName, duration }) => {
          // Custom logic, e.g., send to monitoring service
          reportToMonitoringSystem({ pluginName, hookName, duration })
        },
      }
    ),
  ],
})
```

---

## 🧩 API

### `wrapPlugin(plugin: Plugin, options?: Partial<WrapPluginOptions>): Plugin`

#### Parameters

- `plugin`: A Vite plugin object
- `options`: Optional configuration object

#### `WrapPluginOptions` Interface

| Option            | Type                                      | Default                      | Description                            |
| ----------------- | ----------------------------------------- | ---------------------------- | -------------------------------------- |
| `threshold`       | `number`                                  | `0`                          | Minimum duration (ms) to log a hook    |
| `onHookExecution` | `(params: OnHookExecutionParams) => void` | `undefined`                  | Callback invoked when a hook completes |
| `hooks`           | `PluginHooks[]`                           | Common hook list (see below) | List of Vite plugin hooks to wrap      |
| `slient`          | `boolean`                                 | `false`                      | Suppress default console output        |

#### Default Hook List:

```ts
[
  'options',
  'buildStart',
  'resolveId',
  'load',
  'transform',
  'buildEnd',
  'generateBundle',
  'renderChunk',
  'writeBundle',
]
```

---

## 🧪 Example Output

When a hook's execution time exceeds the threshold, output will be shown in the console:

```
[my-plugin] transform            ⏱  132.57 ms
```

---

## 📘 Types

### `OnHookExecutionParams`

```ts
interface OnHookExecutionParams {
  pluginName: string
  hookName: string
  args: any[]
  duration: number
}
```

---

## ⚠️ Notes

- This utility only works with object-based plugin definitions. It does not support plugins returned as arrays.
- Async hooks are automatically awaited to ensure accurate timing.

---

## 📄 License

MIT
