# 自动路由（`weapp-vite/auto-routes`）

`weapp-vite` 提供了一个可选的“自动路由服务”，会扫描 `src/pages/**` 以及各分包 `root/pages/**` 下的页面，自动生成路由清单并导出到虚拟模块 `weapp-vite/auto-routes`。你不再需要手写 `app.json` 的 `pages` 数组，即可在代码里直接引用准确的路由信息。

## 适用场景

- 团队遵循约定式目录结构，希望新增页面后自动更新 `pages`。
- 需要在 TypeScript 里获取“页面路径”类型提示，避免字符串拼写错误。
- 想自动区分主包与分包入口，辅助生成导航菜单、埋点等数据。

## 快速开启

自动路由默认关闭，在 `vite.config.ts` 中启用即可：

```ts
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    autoRoutes: true,
  },
})
```

启用后会自动完成以下工作：

- 生成 `typed-router.d.ts`（与配置文件同级），里面包含 `AutoRoutes` 相关类型；
- 暴露虚拟模块 `weapp-vite/auto-routes`，默认导出完整路由对象，并额外提供 `entries`、`pages`、`subPackages` 等数组；
- 在开发与构建过程中持续监听页面相关文件，增删改都会立刻刷新清单并触发热更新。

## 监听范围

当自动路由开启后，以下文件会纳入监听：

- 页面脚本：`.js` / `.jsx` / `.ts` / `.tsx` / `.vue`
- 页面模板：`.wxml` 以及 `pages/**/*.vue`
- 页面样式：`.wxss`、`.css`、`.scss`、`.less`、`.sass`、`.styl(us)` 等
- 页面/应用配置：`app.json`、页面 `json`，以及通过 `configExtensions` 声明的扩展后缀

新增或删除这些文件（例如 `pages/foo/index.wxss`、`pages/foo/index.ts`）都会同步更新路由清单。

## 在代码中使用

自动路由模块默认导出 `routes` 对象，包含主包与分包的完整信息，同时提供若干辅助数组方便按需使用：

```ts
import routes, { entries, pages, subPackages } from 'weapp-vite/auto-routes'

console.log(routes.pages) // 主包页面清单
console.log(routes.entries) // 所有入口（主包 + 分包）
console.log(routes.subPackages) // 分包 root 与页面列表
```

在 TypeScript 项目中，可以直接引用 `typed-router.d.ts` 生成的类型，获得枚举式的路径提示，例如：

```ts
import type { AutoRoutes } from 'weapp-vite/auto-routes'

function jump(route: AutoRoutes.Pages) {
  wx.navigateTo({ url: route })
}
```

随着文件结构变化，类型声明也会自动刷新，无需手动维护。

## 常见问题

- **为什么没有生成路由？** 请确认项目遵循“`pages/**/index` 或 `pages/**/main`”等约定结构，并确保 `autoRoutes` 已启用。首次开启后若未看到文件，请重启 `pnpm dev` 以初始化监听器。
- **如何支持自定义目录结构？** 可以结合 [`weapp.autoRoutes.include/exclude`](/config/enhance-and-debug.md#weapp-autoroutes) 去调整扫描范围，或在 monorepo 中为不同子包指定根目录。
- **typed 文件可以提交吗？** `typed-router.d.ts` 会随构建自动更新，通常推荐加入 `.gitignore`，仅在需要固定类型时再纳入版本控制。
