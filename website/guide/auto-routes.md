---
title: 自动路由（weapp-vite/auto-routes）
description: weapp-vite 提供可选的自动路由能力，扫描主包和分包页面目录，生成路由清单、类型声明与虚拟模块导出。
keywords:
  - Weapp-vite
  - guide
  - auto
  - routes
  - 自动生成路由清单
  - 并通过虚拟模块
  - weapp-vite/auto-routes
  - 导出。
---

# 自动路由（`weapp-vite/auto-routes`）

`weapp-vite` 提供了一个可选的“自动路由”能力：扫描主包/分包的页面目录，自动生成路由清单，并通过虚拟模块 `weapp-vite/auto-routes` 导出。

它解决的核心问题是：**生成一份随目录变化的路由清单**，供 `app.json.ts` 或业务代码消费，同时在 TypeScript 里还能拿到“页面路径”的类型提示，避免字符串写错。

## 适用场景

- 团队遵循约定式目录结构，希望“新增页面 = 自动进清单”，再由 `app.json.ts` 自动组装。
- 希望在 TypeScript 里拿到页面路径的类型提示（少写错、少返工）。
- 想区分主包/分包入口，用于生成导航菜单、埋点清单等数据。

## 快速开启

自动路由默认关闭；如果想启用或做细粒度控制，可以在 `vite.config.ts` 中配置：

```ts
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    autoRoutes: {
      enabled: true,
      typedRouter: true,
      include: ['pages/**'],
      persistentCache: false,
      watch: true,
    },
  },
})
```

启用后会自动完成以下工作：

- 生成 `.weapp-vite/typed-router.d.ts`，里面包含 `AutoRoutes` 等类型；
- 暴露虚拟模块 `weapp-vite/auto-routes`，默认导出完整路由对象，并额外提供 `entries`、`pages`、`subPackages` 等数组；
- 在开发与构建过程中持续监听页面相关文件，增删改都会立刻刷新清单并触发热更新。

如果你还没跑过 `dev/build`，但希望先把这些支持文件产出来，也可以手动执行：

```bash
weapp-vite prepare
```

## 默认扫描规则

不传 `include` 时，自动路由不会做“全局 `**/pages/**` 扫描”。

默认行为只有两条：

- 主包：扫描 `srcRoot/pages/**`
- 分包：扫描 **已声明在 `weapp.subPackages` 中的每个 root** 下的 `pages/**`

例如：

```ts
export default defineConfig({
  weapp: {
    srcRoot: 'src',
    autoRoutes: true,
    subPackages: {
      'subpackages/marketing': {},
      'packageA': {},
    },
  },
})
```

这时默认会扫描：

- `src/pages/**`
- `src/subpackages/marketing/pages/**`
- `src/packageA/pages/**`

但不会把下面这些目录误当成页面：

- `src/components/pages/**`
- `src/features/foo/pages/**`，除非你显式把 `features/foo` 声明为分包 root，或通过 `include` 手动放开

这样做的目的是避免把“只是名字里带 `pages` 的目录”误识别成真实页面目录。

> [!TIP]
> 扫描的“根目录”受 `weapp.srcRoot` 影响：如果你的源码在 `miniprogram/` 或 `src/`，先把 `weapp.srcRoot` 配对（参考 `/config/paths`），再开启自动路由会更顺滑。

如果你只想快速开关，仍然可以继续使用：

```ts
export default defineConfig({
  weapp: {
    autoRoutes: true,
  },
})
```

如果你的目录不是传统的 `pages/**`，也可以手动指定多个 glob / 正则规则：

```ts
export default defineConfig({
  weapp: {
    autoRoutes: {
      enabled: true,
      include: [
        'views/**',
        'pkgA/screens/**',
        /^features\/[^/]+\/screens\/.+$/,
      ],
    },
    subPackages: {
      pkgA: {},
    },
  },
})
```

这里有两个关键点：

- `include` 是按“路由基础路径”匹配的，不需要带文件扩展名；
- 如果分包目录不再沿用 `root/pages/**` 约定，建议同时声明 `weapp.subPackages`，这样自动路由才能把它稳定归入 `subPackages`，而不是主包 `pages`。

## 分包扫描规则

自动路由里的“分包扫描”和“分包归属”是两件事，但它们最好一起配置：

1. 扫描入口：
   `weapp.subPackages` 会告诉自动路由“哪些 root 应该按分包目录处理”。
2. 归属输出：
   命中的页面会被写入 `routes.subPackages`，最终可直接喂给 `defineAppJson({ subPackages })`。

推荐写法：

```ts
export default defineConfig({
  weapp: {
    autoRoutes: true,
    subPackages: {
      'subpackages/marketing': {},
      'subpackages/lab': {
        independent: true,
      },
    },
  },
})
```

对应目录：

- `src/subpackages/marketing/pages/**`
- `src/subpackages/lab/pages/**`

如果你只写了目录、没有声明 `weapp.subPackages`，那在默认规则下这些页面不会自动进入 `routes.subPackages`。这也是为什么现在文档更推荐把“分包 root”显式写到配置里，而不是依赖宽泛目录猜测。

## 监听范围

当自动路由开启后，以下文件会纳入监听：

- 页面脚本：`.js` / `.jsx` / `.ts` / `.tsx` / `.vue`
- 页面模板：`.wxml` 以及 `.vue`
- 页面样式：`.wxss`、`.css`、`.scss`、`.less`、`.sass`、`.styl(us)` 等
- 页面/应用配置：`app.json`、页面 `json`，以及通过 `configExtensions` 声明的扩展后缀

新增或删除这些文件（例如 `pages/foo/index.wxss`、`pages/foo/index.ts`）都会同步更新路由清单。

路由识别规则：

- 默认扫描主包 `pages/**`，以及已声明分包 root 下的 `pages/**`，不会把任意 `**/pages/**` 都视为页面目录；也可以通过 `include` 改成任意 glob / 正则；
- 同一路径下 **只要存在脚本 / 模板 / 配置之一** 即可作为页面；但若 `json.component === true` 会被排除（视为组件）；
- 分包归属优先参考 `weapp.subPackages` 的 root；如果未声明，则回退到传统的 `root/pages/**` 目录约定自动推断。

## 在代码中使用

自动路由模块默认导出 `routes` 对象，包含主包与分包的完整信息，同时提供若干辅助数组方便按需使用：

```ts
import routes, { entries, pages, subPackages, wxRouter } from 'weapp-vite/auto-routes'

console.log(routes.pages) // 主包页面清单
console.log(routes.entries) // 所有入口（主包 + 分包）
console.log(routes.subPackages) // 分包 root 与页面列表
wxRouter.navigateTo({ url: '/pages/index/index' }) // 带路由联合类型提示
```

在 TypeScript 项目中，可以直接引用 `typed-router.d.ts` 生成的类型，获得枚举式的路径提示，例如：

```ts
import type { AutoRoutes } from 'weapp-vite/auto-routes'

function jump(route: AutoRoutes['entries'][number]) {
  wx.navigateTo({ url: route })
}
```

随着文件结构变化，类型声明也会自动刷新，无需手动维护。

`persistentCache` 默认关闭；如果你希望缓存落到自定义位置，也可以直接传字符串路径：

```ts
export default defineConfig({
  weapp: {
    autoRoutes: {
      enabled: true,
      persistentCache: '.cache/auto-routes.json',
    },
  },
})
```

相对路径会基于 `vite.config.*` 所在目录解析；如果没有配置文件路径，则退回到当前工作目录。

如果你在项目里使用 `wevu` 的 `useNativeRouter()/useNativePageRouter()`，或 `wevu/router` 的 `useRouter()`，`typed-router.d.ts` 还会自动注入模块增强，让 Router 的 `url` 参数继承自动路由联合类型（同时保留 `./detail`、`../detail` 这类相对路径写法）。

如果你还想让 `switchTab` 类型更严格（只允许 tabBar 页面），可在业务项目里声明合并 `WevuTypedRouterRouteMap.tabBarEntries` 来进一步收窄。

> [!TIP]
> 如果你的项目需要兼容较低基础库（`Router` 原生对象可能不存在），`wevu` 会回退到全局路由方法（`wx/my/tt`）。这时为保持跨版本一致性，建议在关键跳转优先使用绝对路径（例如 `AutoRoutes['entries'][number]`）。

## 写入 `app.json` 的方式

自动路由不会直接改写纯 JSON 文件。若希望 `app.json` 自动更新，推荐改为脚本配置：

```ts
// app.json.ts
import routes from 'weapp-vite/auto-routes'
import { defineAppJson } from 'weapp-vite/json'

export default defineAppJson({
  pages: routes.pages,
  subPackages: routes.subPackages,
})
```

## 常见问题

- **为什么没有生成路由？**
  - 确认页面文件命中了 `autoRoutes.include` 规则；默认是 `srcRoot/pages/**`，以及已声明分包 root 下的 `pages/**`。
  - 如果页面位于分包目录下，确认对应 root 已经声明在 `weapp.subPackages` 中。
  - 确认页面目录下至少存在脚本 / 模板 / `json` 文件之一，且 `json.component !== true`。
  - 确认 `autoRoutes: true` 已开启。
  - 首次开启后如果没看到变化，重启一次 `pnpm dev`，让监听器重新初始化。
- **如何支持自定义目录结构？** 直接通过 `autoRoutes.include` 配置 glob / 正则即可；如果这些页面属于分包，同时补上 `weapp.subPackages` root，会比依赖目录约定更稳定。
- **`typed-router.d.ts` 要不要提交到仓库？** 它会随构建自动更新，通常建议加入 `.gitignore`；只有在你确实想把类型“固定下来”时再提交。
