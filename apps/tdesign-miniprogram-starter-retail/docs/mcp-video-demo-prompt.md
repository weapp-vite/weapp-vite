# MCP 视频演示提示词使用指南

## 1. 简介

这段提示词适合录制演示视频时直接使用。它会让 AI 通过 `weapp-vite` MCP 完成一次节奏清晰的可视化流程：打开首页、切到购物车、读取节点、临时修改 UI、保存前后截图。

## 2. 录屏版提示词

```text
你现在连接的是 weapp-vite MCP，目标应用是 apps/tdesign-miniprogram-starter-retail。

我要录制 MCP 演示视频。请用最短、最可见的流程演示：连接微信开发者工具、打开页面、截图、切换 tab、读取真实节点、临时修改 UI、再次截图并验证结果。优先使用 weapp-vite MCP，不要用普通浏览器工具。

请按这个流程执行：
1. 连接目标小程序项目 apps/tdesign-miniprogram-starter-retail/dist；如果当前目录已经是目标应用，则使用 dist。
2. 打开 pages/home/home，等待稳定后截图到 .weapp-vite/demo-01-home.png。
3. 切到底部“购物车”tab，确认当前页面是 pages/cart/index，截图到 .weapp-vite/demo-02-cart-before.png。
4. 查找底部第三个 tab 文本节点，优先使用 .index--text[index=2]。
5. 读取该节点的 markup、styles、measure，只输出关键字段：text、width、height、offset。
6. 只做运行时临时修改，不改源码：把底部第三个 tab 文本从“购物车”改成“由 MCP 修改”。
7. 再次读取同一个节点，确认文本和宽度已变化，截图到 .weapp-vite/demo-03-cart-after.png。
8. 校验 demo-02-cart-before.png 和 demo-03-cart-after.png 都存在，并确认哈希或文件大小不同。

最后用适合视频收尾的短格式输出：
- 用到的 MCP 能力
- 三张截图路径
- 当前页面路径
- 节点修改前后对比
- 是否成功
- 一句话总结：AI 已通过 weapp-vite MCP 完成真实小程序运行时查看、操作、读取和临时 UI 修改
```

## 3. 成功效果

| 阶段       | 观众能看到什么                                |
| ---------- | --------------------------------------------- |
| 首页截图   | MCP 打开真实小程序页面                        |
| 购物车截图 | MCP 完成 tab 切换                             |
| 节点读取   | AI 读到真实运行时结构、样式和尺寸             |
| UI 修改    | 底部第三个 tab 从 `购物车` 变成 `由 MCP 修改` |
| 结果验证   | 前后截图不同，当前页仍是 `pages/cart/index`   |
