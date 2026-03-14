---
title: project.config.json
description: 微信开发者工具项目配置文件，定义 miniprogramRoot、appid 等平台侧参数。
---

# `project.config.json`

这是微信开发者工具项目配置，不属于 `weapp-vite` 的目录约定能力本身，但它决定开发者工具怎样打开和编译你的项目。

## 常见职责

- 指定 `miniprogramRoot`
- 保存 `appid`
- 控制开发者工具的编译选项

## 与目录结构的关系

最常见的一点是：它通常需要把 `miniprogramRoot` 指向 `dist/`，因为 `weapp-vite` 的源码目录和最终小程序运行目录不是同一个位置。

```json
{
  "miniprogramRoot": "dist/",
  "compileType": "miniprogram"
}
```

如果你发现开发者工具打开后目录不对、页面不出现，先检查这里。
