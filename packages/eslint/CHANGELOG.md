# @weapp-vite/eslint

## 0.2.3

### Patch Changes

- 修复 Wevu 首屏异步导航对宿主 `queueMicrotask` 和现代内建的隐式依赖，收紧 headless simulator 的 AppService 全局边界，并新增仅作用于小程序运行时代码的 ESLint API 门禁、模板配置与真实 DevTools 验证规范。

## 0.2.2

### Patch Changes

- 将包主页、随包文档、脚手架默认链接与小程序 JSON Schema 地址统一迁移到 `vite.weapp.dev`，确保新生成项目和公开元数据使用新的文档主域名。

## 0.2.1

### Patch Changes

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/ast：dependencies.@oxc-project/types
  - @weapp-vite/eslint：devDependencies.@typescript-eslint/parser

## 0.2.0

### Minor Changes

- 新增 Wevu 兼容性清单与静态 API 防护，补齐 SFC scoped、CSS Modules 和 CSS `v-bind()` 的编译及运行时桥接，并同步模板、网站和迁移文档。
