---
title: 目录结构
description: Weapp-vite 的目录结构总览页，按 Nuxt 式目录索引组织，左侧目录项为独立路由，右侧为每个目录或文件的详细说明。
keywords:
  - 目录结构
  - directory structure
  - srcRoot
  - autoRoutes
  - autoImportComponents
  - subPackages
---

# 目录结构

这一组文档按“目录即能力边界”的方式组织，交互形态参考 Nuxt 的 directory structure 页面。

- 左侧每一个目录或文件项，都是单独的文档路由
- 右侧页面只解释当前项的职责、默认行为和触发的能力
- 如果你只想先看全局，再决定点进哪个目录，从这页开始就够了

## 一个典型项目

```text
.
├─ vite.config.ts
├─ project.config.json
├─ package.json
├─ public/
└─ <srcRoot>/
   ├─ app.(js|ts)
   ├─ app.vue
   ├─ app.json(.js|.ts)?
   ├─ app.(css|scss|wxss|...)
   ├─ layouts/
   ├─ custom-tab-bar/
   ├─ app-bar/
   ├─ pages/
   ├─ components/
   ├─ <subPackageRoot>/
   │  ├─ pages/
   │  └─ components/
   ├─ shared/
   ├─ utils/
   ├─ workers/
   ├─ typed-router.d.ts
   ├─ typed-components.d.ts
   └─ components.d.ts
```

## 先记住三条

1. `weapp-vite` 真正依赖的是 `srcRoot`，不是硬编码的 `src/`
2. 页面自动扫描默认只看 `srcRoot/pages/**` 和已声明分包 root 下的 `pages/**`
3. `layouts`、`custom-tab-bar`、`app-bar`、类型声明文件这些都属于带固定语义的保留位置

> [!TIP]
> 这一组文档里的 `<srcRoot>`、`<subPackageRoot>` 都是变量占位，不是固定目录名。它们分别代表你在 `vite.config.ts` 中声明的源码根目录和分包 root。

<DirectoryStructureCatalog />

## 从哪里开始看

- 想先建立全局认知：看 [📄 vite.config.ts](/guide/directory-structure/vite-config)、[📁 `<srcRoot>/`](/guide/directory-structure/src-root)
- 想搞清楚页面 layout 放哪里：看 [📁 `<srcRoot>/layouts/`](/guide/directory-structure/layouts)
- 想搞清楚页面与分包：看 [📁 `<srcRoot>/pages/`](/guide/directory-structure/pages)、[📁 `<srcRoot>/<subPackageRoot>/`](/guide/directory-structure/subpackages)
- 想搞清楚自动生成产物：看 [类型声明文件](/guide/directory-structure/generated-files)

## 默认能力速查

| 位置                                                              | 作用                                               |
| ----------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------- | ----- | ------------------------------------------- |
| `vite.config.ts`                                                  | 定义 `srcRoot`、自动路由、分包、自动导入组件等能力 |
| `project.config.json`                                             | 微信开发者工具配置                                 |
| `public/`                                                         | 构建时原样复制的静态资源                           |
| `app.(js                                                          | ts)`                                               | 应用脚本入口，承载生命周期和全局初始化          |
| `app.vue`                                                         | Vue SFC 形式的应用入口，可组合脚本、JSON 宏与样式  |
| `app.json(.js                                                     | .ts)?`                                             | 应用配置入口，既支持原生 JSON，也支持脚本化生成 |
| `app.(css                                                         | scss                                               | wxss                                            | ...)` | 全局样式入口，支持 CSS、WXSS 与常见预处理器 |
| `layouts/`                                                        | 页面 layout 约定目录，承载默认布局和命名布局       |
| `pages/`                                                          | 主包页面目录                                       |
| `components/`                                                     | 主包组件目录，默认参与自动导入扫描                 |
| `<subPackageRoot>/pages/`                                         | 已声明分包 root 下的页面目录                       |
| `custom-tab-bar/`                                                 | `tabBar.custom === true` 时的固定入口              |
| `app-bar/`                                                        | `appBar` 开启时的固定入口                          |
| `typed-router.d.ts` / `typed-components.d.ts` / `components.d.ts` | 自动生成的类型声明文件                             |

## 相关文档

- [自动路由](/guide/auto-routes)
- [页面 Layout 使用指南](/guide/layouts)
- [自动导入组件](/guide/auto-import)
- [分包指南](/guide/subpackage)
- [手动集成](/guide/manual-integration)
