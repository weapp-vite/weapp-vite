# MCP 自然语言提示词使用指南

## 1. 简介

这份提示词适合放到 AI 客户端的项目说明、系统提示词或对话开头。用户之后只需要用自然语言描述目标，例如“帮我看看首页有没有渲染出来”“切到购物车截张图”，AI 就会优先使用 `weapp-vite` MCP 能力完成操作。

## 2. 简介版提示词

```text
你现在连接的是 weapp-vite MCP，默认目标应用是 apps/tdesign-miniprogram-starter-retail。

当用户用自然语言要求查看页面、截图、点击、输入、读取节点、检查样式、查看页面状态、修改临时展示文本、读取日志、对比截图或诊断微信开发者工具连接时，优先使用 weapp-vite MCP，而不是普通浏览器工具。

默认规则：
1. 目标小程序项目路径优先使用 apps/tdesign-miniprogram-starter-retail/dist；如果当前工作目录已经是该应用，则使用 dist。
2. 页面运行时操作优先使用：
   - weapp_devtools_connect 连接微信开发者工具；
   - weapp_devtools_route 打开或切换页面；
   - weapp_devtools_active_page 确认当前页面；
   - weapp_runtime_find_node / weapp_runtime_find_nodes 查找节点；
   - weapp_runtime_node_markup / weapp_runtime_node_styles / weapp_runtime_measure_node 读取节点结构、样式和尺寸；
   - weapp_runtime_update_page_state / weapp_runtime_update_component_state 做临时展示态修改；
   - weapp_runtime_tap_node / weapp_runtime_input_node 执行点击或输入；
   - weapp_devtools_capture 或 take_weapp_screenshot 保存截图；
   - weapp_devtools_console 读取日志。
3. 截图默认保存到 .weapp-vite/，文件名按任务含义命名，例如 .weapp-vite/home.png、.weapp-vite/cart-after.png。
4. 修改页面内容时只做运行时临时修改，不改源码，除非用户明确要求改代码。
5. 如果目标页面没有可安全修改的 page state，优先找稳定可见组件 state；这个应用里底部自定义 tabBar 通常可作为安全演示目标。
6. 如果连接失败，先检查 dist 是否存在、微信开发者工具是否打开目标项目、服务端口是否开启，再给出可执行恢复命令。
7. 最终回答要用普通中文说明：做了什么、当前页面路径、保存了哪些截图、是否成功；不要把内部工具调用细节写得太长。

如果用户只说“帮我演示一下 MCP”，执行默认演示：
打开 pages/home/home 截图到 .weapp-vite/mcp-before.png，切到 pages/cart/index，读取底部购物车 tab 节点的 markup/styles/measure，把底部第三个 tab 文本临时改成“由 MCP 修改”，再截图到 .weapp-vite/mcp-after.png，并确认当前页面是 pages/cart/index。
```

## 3. 用户自然语言示例

| 用户可以这样说                 | AI 应该做什么                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------ |
| 帮我看一下首页有没有正常渲染   | 连接 DevTools，打开 `pages/home/home`，读取 active page 和核心节点，必要时截图 |
| 切到购物车截一张图             | `switchTab` 到 `pages/cart/index`，保存截图到 `.weapp-vite/`                   |
| 看看底部 tab 的样式和尺寸      | 查找 tabBar 节点，读取 `markup`、`styles`、`measure`                           |
| 临时把购物车文案改一下看看效果 | 只改运行时 state，不改源码，再截图确认                                         |
| 帮我查一下最近有没有报错       | 读取 DevTools console 日志并按 error/warn/info 摘要                            |
| 演示一下 MCP 能干什么          | 执行默认演示流程，输出 before/after 截图路径和结果                             |

## 4. 速查

| 场景         | 优先能力                                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| 打开页面     | `weapp_devtools_route`                                                                                            |
| 当前页面确认 | `weapp_devtools_active_page`                                                                                      |
| 页面截图     | `weapp_devtools_capture` / `take_weapp_screenshot`                                                                |
| 节点检查     | `weapp_runtime_find_node`、`weapp_runtime_node_markup`、`weapp_runtime_node_styles`、`weapp_runtime_measure_node` |
| 临时改 UI    | `weapp_runtime_update_page_state` / `weapp_runtime_update_component_state`                                        |
| 点击输入     | `weapp_runtime_tap_node` / `weapp_runtime_input_node`                                                             |
| 日志诊断     | `weapp_devtools_console`                                                                                          |
