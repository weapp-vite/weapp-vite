# 自动路由（`weapp-vite/auto-routes`）

`weapp-vite` 提供了一个可选的“自动路由”能力：扫描主包/分包的页面目录，自动生成路由清单，并通过虚拟模块 `weapp-vite/auto-routes` 导出。

它解决的核心问题是：**不用再手动维护 `app.json.pages`**，同时在 TypeScript 里还能拿到“页面路径”的类型提示，避免字符串写错。

## 适用场景

- 团队遵循约定式目录结构，希望“新增页面 = 自动进路由表”。
- 希望在 TypeScript 里拿到页面路径的类型提示（少写错、少返工）。
- 想区分主包/分包入口，用于生成导航菜单、埋点清单等数据。

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

- 生成 `typed-router.d.ts`（与配置文件同级），里面包含 `AutoRoutes` 等类型；
- 暴露虚拟模块 `weapp-vite/auto-routes`，默认导出完整路由对象，并额外提供 `entries`、`pages`、`subPackages` 等数组；
- 在开发与构建过程中持续监听页面相关文件，增删改都会立刻刷新清单并触发热更新。

> [!TIP]
> 扫描的“根目录”受 `weapp.srcRoot` 影响：如果你的源码在 `miniprogram/` 或 `src/`，先把 `weapp.srcRoot` 配对（参考 `/config/paths`），再开启自动路由会更顺滑。

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

- **为什么没有生成路由？**
  - 确认项目遵循约定结构：默认匹配 `pages/**/index` 或 `pages/**/main`。
  - 确认 `autoRoutes: true` 已开启。
  - 首次开启后如果没看到变化，重启一次 `pnpm dev`，让监听器重新初始化。
- **如何支持自定义目录结构？** 用 [`weapp.autoRoutes.include/exclude`](/config/shared.md#weapp-autoroutes) 调整扫描范围；monorepo 场景也可以为不同子项目分别设置 `weapp.srcRoot`。
- **`typed-router.d.ts` 要不要提交到仓库？** 它会随构建自动更新，通常建议加入 `.gitignore`；只有在你确实想把类型“固定下来”时再提交。
