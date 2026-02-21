# vite-plugin-performance

`vite-plugin-performance` 用于包装一个或多个 Vite 插件，并统计每个生命周期 Hook 的执行耗时。

## 何时使用

- 你要定位构建慢点来自哪个插件/Hook
- 你要为插件性能监控打点
- 你要在不改插件实现的前提下测量耗时

## 安装

```bash
pnpm add -D vite-plugin-performance
```

## 最小示例

```ts
import { defineConfig } from 'vite'
import Inspect from 'vite-plugin-inspect'
import { wrapPlugin } from 'vite-plugin-performance'

export default defineConfig({
  plugins: [
    wrapPlugin(Inspect(), {
      threshold: 50,
    }),
  ],
})
```

## 常用选项

- `hooks`: 指定要统计的 Hook，或传 `'all'`
- `threshold`: 仅输出大于等于阈值的耗时
- `silent`: 关闭默认日志
- `logger`: 自定义日志输出
- `formatter`: 自定义日志格式
- `onHookExecution`: 每次统计完成后的回调

## 相关导出

- `wrapPlugin`
- `DEFAULT_PLUGIN_HOOKS`
- `DEFAULT_THRESHOLD`
