---
title: <subPackageRoot>
description: 分包目录与分包 root 的关系说明，weapp.subPackages 才是分包边界的权威配置。
---

# `<subPackageRoot>/`

`weapp-vite` 不要求分包必须叫 `packages/` 或 `subpackages/`。
真正决定“这是不是分包”的，是你是否把该目录声明到 `weapp.subPackages`。

## 推荐配置

```ts
export default defineConfig({
  weapp: {
    subPackages: {
      'packageA': {},
      'subpackages/marketing': {
        independent: true,
      },
    },
  },
})
```

## 对应目录

```text
<srcRoot>/
  <subPackageRoot>/
    pages/
    components/
  subpackages/
    marketing/
      pages/
      components/
```

## 默认行为

- `<srcRoot>/<subPackageRoot>/pages/**` 会被识别为分包页面
- `<srcRoot>/<subPackageRoot>/components/**` 会被识别为分包组件
- 页面会进入自动路由的 `subPackages` 结果

如果你只建目录，不声明 `weapp.subPackages`，那它就不是稳定的分包边界。
