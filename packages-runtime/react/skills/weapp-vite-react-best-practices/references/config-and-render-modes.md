# React 配置与渲染模式

## 消费项目资料与前提

- runtime 和 bridge 的公开 API 查已安装 `@weapp-vite/react` 的 README 与类型；完整用法见 [React 小程序接入](https://vite.weapp.dev/integration/react)。不要求读取框架源码目录。
- 下方 `weapp.react` 配置由 `weapp-vite` 持有，需项目显式安装该构建器；完整字段见 [React 配置](https://vite.weapp.dev/config/react)。仅安装 runtime 时，不新增或假定存在此配置文件。
- 先核对当前 runtime 的 peer dependencies，再使用项目已有的 build/typecheck scripts；不把仓库验证依赖版本当作所有版本的安装约束。

## 配置基线（需要 weapp-vite）

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    react: {
      compiler: false,
      devWarnings: true,
      renderMode: 'auto',
    },
  },
})
```

- `react: true` 等价于使用默认配置。
- `auto` 优先静态 WXML/binding slots，并只为不含 bridge 的动态结构使用 reconciler tree。
- `dynamic` 全量使用 reconciler tree，适合排障，但不能承载原生组件 bridge。
- `static` 强制静态证明；遇到列表、条件或其他不受支持结构时应失败。

## React Compiler

- 默认关闭，不把 Compiler 当作 React runtime 的前置条件。
- 显式启用时使用 `compiler: { engine: 'swc', compilationMode: 'infer' }`，并安装可选依赖 `@swc/core`。
- native transform 加载或执行失败时应回退 Oxc JSX transform，并输出带文件位置的 warning。
- 检查 sourcemap、warning 和运行时结果，不只检查编译命令退出码。

## 平台与所有权

- 当前 React runtime 只承诺微信小程序。
- `.jsx` / `.tsx` 的 owner 是项目级选择；启用 `weapp.react` 后不要在同一构建中写 Wevu JSX。
- `.vue` 仍可由 Wevu compiler 处理，但需显式安装 `wevu`，并通过自定义组件 bridge 与 React 互操作。
