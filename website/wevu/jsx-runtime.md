---
title: wevu/jsx-runtime
description: 说明 wevu/jsx-runtime 的用途、适用范围与 TypeScript JSX 配置方式。
keywords:
  - wevu/jsx-runtime
  - jsx
  - typescript
  - wevu
---

# `wevu/jsx-runtime`

`wevu/jsx-runtime` 主要是一个类型入口，用于让 TypeScript 在 `jsxImportSource: "wevu"` 场景下正确理解 Wevu 的 JSX 命名空间与小程序内建标签类型。

它不是一个面向业务的“运行时 API 集合”，更接近“给 JSX/TSX 类型系统用的入口”。

:::warning 安装方式
在 `weapp-vite` 项目里，`wevu` 通常建议安装在 `devDependencies` 中：

```sh
pnpm add -D wevu
```

若你是在其他 JSX/TSX 工程里单独消费 `wevu/jsx-runtime`，则应按自己的发布方式决定依赖落位。
:::

## 1. 当前定位

- 子路径：`wevu/jsx-runtime`
- 主要导出：`JSX` 命名空间类型
- 作用：补充 `IntrinsicElements`、`GlobalComponents` 与小程序标签的属性推导

## 2. 什么时候需要它

- 你在项目里启用了 TSX / JSX
- 你希望通过 `jsxImportSource: "wevu"` 获得更准确的类型提示
- 你在做底层组件封装、类型实验或自定义编译链适配

如果你的项目主要是 `.vue` SFC 或传统小程序页面，不一定会直接接触这个子路径。

## 3. TypeScript 配置示例

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "wevu"
  }
}
```

当配置为 `jsxImportSource: "wevu"` 时，TypeScript 会解析 `wevu/jsx-runtime` 的类型入口。

## 4. 它解决什么问题

- 让 JSX 环境下的小程序标签有更合理的属性提示
- 让全局组件类型可以合并进 `IntrinsicElements`
- 避免 JSX 类型系统默认回落到不适合 Wevu 的 Web/Vue 语义

## 5. 注意事项

- 这是“类型辅助入口”，不是常规运行时导入入口
- 业务代码日常仍然优先从 `wevu` 主入口导入 API
- 如果你没有启用 JSX/TSX，通常不需要显式导入它

## 6. 相关页面

- [Core API](/wevu/api/core)
- [Vue SFC 基础](/wevu/vue-sfc/basics)
