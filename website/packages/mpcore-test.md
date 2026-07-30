---
title: 小程序页面与组件测试
description: 使用 mpcore、Vitest 与 weapp-vite 真实编译产物测试微信小程序页面和组件。
---

# 小程序页面与组件测试

mpcore 测试环境直接执行微信小程序编译产物，模拟微信宿主与逻辑 WXML 树。它不是 jsdom，不暴露浏览器 `document/window`，因此断言关注页面数据、生命周期、组件 properties/observer、事件和逻辑节点。

## 包职责

| 包                   | 职责                                                       |
| -------------------- | ---------------------------------------------------------- |
| `@mpcore/simulator`  | 编译产物执行、微信宿主、生命周期与资源调度内核             |
| `@mpcore/test`       | 页面/组件 render、查询、交互、mock、diagnostics 与 matcher |
| `@mpcore/vitest`     | matcher 注册、每测试 session 与自动 cleanup                |
| `@mpcore/weapp-vite` | 通过 `weapp-vite/test` 构建并缓存真实测试产物              |

## 示例

```ts
const project = await createWeappViteTestProject({ cwd: process.cwd() })
const result = await project.renderComponent('components/counter/index', {
  properties: { value: 1 },
  slots: { default: '<text>计数器</text>' },
})

await result.user.tap(result.screen.getByRole('button', { name: '增加' }))
expect(result.screen.getByText('2')).toBeInTheMiniProgram()
expect(result).toHaveEmitted('change', { value: 2 })
```

查询支持 `ByText`、`ByRole`、`ByTestId`、`ByAttribute`、`within()` 与同步/异步变体。交互支持 `tap/input/change/blur/trigger`。不提供依赖 CSS layout 的可见性断言。

默认构建目录是 `.weapp-vite/test-artifacts/`。冷构建和 watch 重建都通过 Vite/Rolldown 写产物，保留真实分包、chunk 和编译结果。
