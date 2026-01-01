# 目录结构

`weapp-vite` 默认沿用原生小程序的目录习惯：`app.*` 放在 `src/`，页面在 `pages/`，分包在 `packages/`。在这个基础上，框架提供了一些“可选但推荐”的约定目录，让自动路由、自动导入组件、分包增强等能力能直接生效。

```text
.
├─ vite.config.ts
├─ project.config.json
├─ typed-router.d.ts          # 自动生成：页面/分包路由类型
├─ public/                    # 静态资源，会直接拷贝到 dist
└─ src/
   ├─ app.ts / app.json / app.scss
   ├─ pages/
   │  └─ index/
   ├─ packages/
   │  ├─ order/
   │  └─ profile/
   ├─ components/
   ├─ shared/
   ├─ action/
   ├─ config/
   ├─ utils/
   └─ workers/
```

> 大多数模板会把 `weapp.srcRoot` 显式设置为 `src/`，让下面这些目录约定开箱即用。如果你的源码位于其他目录（例如 `miniprogram/`），只要在 `vite.config.ts` 里调整 `weapp.srcRoot`，其余能力依旧可用。

## 根目录必备文件

| 路径                  | 说明                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| `vite.config.ts`      | weapp-vite 的主配置。可在 `weapp.subPackages`、`weapp.autoImportComponents` 等字段中定制目录行为。           |
| `project.config.json` | 微信开发者工具项目配置，保持与原生项目一致。                                                                 |
| `typed-router.d.ts`   | 由 `weapp-vite` 自动生成的页面/分包路由类型声明。每次编译会根据 `pages/` 与 `packages/` 更新。               |
| `public/`             | 任意静态资源（icon、字体等）。构建时会原样拷贝到输出目录，适合存放 `sitemap.json`、`theme.json` 的模板文件。 |

## `src/` 内的默认约定

### App 基础文件

| 文件       | 作用                                                                            |
| ---------- | ------------------------------------------------------------------------------- |
| `app.ts`   | 小程序入口脚本，可自由使用 TypeScript、ESM。                                    |
| `app.json` | 仍是微信规范，`weapp-vite` 会原样解析 `pages`、`subPackages`、`tabBar` 等字段。 |
| `app.scss` | 全局样式，框架支持 Sass/Less/Stylus 等预处理器。                                |

> `app.json` 的 `pages` 与 `subPackages` 可以继续手写；也可以开启 [`weapp.autoRoutes`](/guide/auto-routes) 让框架根据目录结构自动补全。

### `pages/` —— 主包页面

- 每个页面占一个目录（例如 `pages/index/`），包含 `index.ts`、`index.wxml`、`index.json`、`index.scss`。
- 默认自动路由策略会把 `pages/**/index` 视为页面入口，并同步生成路由类型。

### `components/` —— 主包组件

- 所有 `components/**/` 下的 `.wxml` 组件会被 **默认自动导入**，无需再手写 `usingComponents`。详见 [自动导入组件](/guide/auto-import)。
- 推荐将复用组件放在此处，框架也会为每个分包生成 `subPackages/<root>/components/**/*.wxml` 的默认扫描规则。

### `packages/` —— 分包

- 目录名直接对应 `app.json` 中的 `root`。
- 在 `vite.config.ts` 中设置 `weapp.subPackages['packages/order']` 可为每个分包开启独立构建、共享样式、定制 `autoImportComponents` 等高级能力，详见 [分包指南](/guide/subpackage)。
- 每个分包内部继续沿用 `pages/`、`components/` 等结构。

### `shared/`

- 非必需，常用于存放跨分包共享的样式、工具模块、设计令牌等。
- 在 `subPackages.<root>.styles` 中引用 `../shared/styles/theme.scss` 即可把主题样式注入到多个分包。

### `action/`、`config/`、`utils/`

- `action/`: 存放抽象的业务动作（如 `action/test1.ts`），便于多个页面调用。
- `config/`: 全局配置或埋点开关，常与 `inlineConfig` 配合，按分包注入常量。
- `utils/`: 公共工具函数。若主包与多个分包同时引用，`weapp-vite` 会根据 [`chunks.sharedStrategy`](/guide/subpackage#代码产物的位置) 自动决定落盘位置。

### `workers/`

- 微信 Worker 入口目录。若在 `app.json` 中配置了 `workers`，再在 `vite.config.ts` 里设置 `weapp.worker.entry` 即可让 weapp-vite 代为打包 worker 代码（参考 [Worker 配置](/config/worker)）。

## 快速生成目录

使用官方模板或 `weapp-vite generate` 脚手架时，以上目录会自动创建。想自定义路径/后缀，可在 `vite.config.ts` 配置 [`weapp.generate`](/config/generate)。

> 希望迁移既有项目？参考[《手动集成》](/guide/manual-integration) 把原小程序源码移动到 `src/`（或你的 `srcRoot`），再补齐配置即可。
