# 自动路由（`weapp-vite/auto-routes`）

`weapp-vite` 提供了一个可选的“自动路由服务”，可以按照约定扫描 `src/pages/**` 以及分包 `root/pages/**` 下的页面，生成一份路由清单并同步导出到虚拟模块 `weapp-vite/auto-routes`。

## 开启方式

自动路由默认关闭，需要在 `vite.config.ts` 中显式开启：

```ts
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    autoRoutes: true,
  },
})
```

启用后，编译器会：

- 生成 `typed-router.d.ts`（位于配置文件同级目录），内含 `AutoRoutes` 相关的类型定义；
- 暴露虚拟模块 `weapp-vite/auto-routes`，可直接导入 `routes / pages / entries / subPackages`；
- 在开发态和构建态持续监听页面相关文件，一旦增删改就触发重建/热更新。

## 监听范围

当自动路由开启后，以下文件会被纳入监听与候选集合：

- 页面脚本：`.js` / `.jsx` / `.ts` / `.tsx` / `.vue`
- 页面模板：`.wxml` 及 `pages/**/*.vue`
- 页面样式：`.wxss`、`.css`、`.scss`、`.less`、`.sass`、`.styl(us)` 等 `supportedCssLangs`
- 页面/应用配置：`app.json`、`page.json` 及 `configExtensions` 对应后缀

新增或移除这些文件（例如 `pages/foo/index.wxss`、`pages/foo/index.ts` 等）都会立即刷新路由清单并推送热更新。

## 在代码中使用

自动路由模块默认导出 `routes` 对象，并提供若干便捷导出的数组，方便在运行期与 IDE 中使用：

```ts
import routes, { entries, pages, subPackages } from 'weapp-vite/auto-routes'

console.log(routes.pages) // 全量主包页面
console.log(routes.entries) // 所有入口（包含分包）
console.log(routes.subPackages) // 分包 root 与页面列表
```

如需在 TypeScript 中获得更严格的提示，可直接引用 `typed-router.d.ts` 中声明的类型（文件会随着路由变化自动刷新）。
