---
title: uview-plus 与 uni-app 组件库
description: 使用 UviewPlusResolver 和实验性的 uni-app 源码兼容层，在 Web、微信开发者工具与 headless 中运行 uview-plus 3.8.86 的 135 个具名组件。
keywords:
  - uview-plus
  - uni-app
  - Vue SFC
  - 微信小程序
  - Web
  - 组件库
---

# uview-plus 与 uni-app 组件库兼容（实验性）

> [!WARNING]
> 当前兼容基线固定为 `uview-plus@3.8.86`。该能力默认关闭，npm 依赖必须显式加入 `weapp.uniApp.include`。

仓库测试基线同时应用 `patches/uview-plus@3.8.86.patch`，修复该版本 `u-slider` 设置 `height` 时引用未定义变量 `val` 的缺陷。升级 uview-plus 时应先确认上游修复状态，再决定是否移除补丁。

## 安装

```bash
pnpm add weapp-vite wevu uview-plus@3.8.86
```

## 配置

```ts
import { defineConfig } from 'weapp-vite/config'
import { UviewPlusResolver } from 'weapp-vite/resolvers'

export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '@use "uview-plus/theme.scss" as *;\n',
      },
    },
  },
  weapp: {
    autoRoutes: true,
    uniApp: {
      include: ['uview-plus'],
    },
    autoImportComponents: {
      resolvers: [UviewPlusResolver()],
      vueComponents: true,
      vueComponentsModule: 'wevu',
    },
  },
})
```

`UviewPlusResolver()` 同时支持 `<u-button>` 与 `<up-button>`，并将它们映射到 npm 包中真实的 `components/u-button/u-button.vue`。返回结果包含真实 `resolvedId`、`sourceType: 'wevu-sfc'` 和 `typeImport: false`，不要通过标签名临时拼接组件路径。

默认只为实际使用的组件生成辅助文件。需要全量类型、HTML custom data 或组件清单时，使用：

```ts
UviewPlusResolver({ supportFilesStrategy: 'full' })
```

## 应用初始化

```ts
import { mount$u } from 'uview-plus'
import { createApp } from 'wevu'

mount$u()

const app = createApp({})
app.config.globalProperties.$u = uni.$u
```

```scss
@import 'uview-plus/index.scss';
```

不要调用 uview-plus 默认插件注册流程。它会尝试通过 Web Vue 的全局组件 API 注册组件，与 Wevu 自动导入的组件所有权冲突。

## 兼容矩阵

矩阵扫描 `uview-plus@3.8.86/components`，并与 resolver 的 137 个源码入口互相校验。135 个具名组件分别生成独立页面，并在三种 runtime 逐页执行：

| Runtime        | 行为覆盖 | 视觉覆盖   |
| -------------- | -------- | ---------- |
| Web 移动端     | 135 页   | 135 张基线 |
| Web 桌面端     | 135 页   | 135 张基线 |
| 微信开发者工具 | 135 页   | 135 张基线 |
| Headless       | 135 页   | 不截图     |

每页都验证目标组件存在、目标与场景容器具有可见边界、没有运行时错误，并完成稳定交互或状态断言。上传、媒体、网络、权限和时钟类能力使用本地资源或确定性测试替身。

`u-action-sheet-data` 与 `u-column-notice` 没有可注册的组件名，因此不伪造独立页面：前者由 action-sheet 场景覆盖，后者由 notice-bar 场景覆盖。

## 已知边界

- 当前验收目标是微信小程序与 Web；支付宝、抖音等分支尚未纳入矩阵。
- 兼容矩阵覆盖每个组件的稳定代表场景，不等同于上游完整业务 Demo。
- uni-app 兼容层不是完整 uni-app runtime，未被矩阵触达的 `uni.*` API 不会自动获得实现。
- 外部 SFC 的样式、资源和最终产物仍由 Vite/Rolldown transform、emit 和 write 管理。
