# MCP 能力展示提示词

把下面这段提示词发给已经接入 `weapp-vite` MCP 的 AI 客户端，可覆盖工作区读取、源码检索、脚本执行、CLI 调用、DevTools 连接、页面路由、运行时节点、页面状态、组件状态、截图、截图对比、日志读取和连接恢复等能力。

```text
你现在连接的是 weapp-vite MCP，目标应用是 apps/tdesign-miniprogram-starter-retail。请完整演示 MCP 能力，并在每一步说明你调用的 MCP 能力、关键输入、关键输出和结论。

前置要求：
1. 优先读取本地文档：packages/weapp-vite/dist/docs/index.md、packages/weapp-vite/dist/docs/ai-workflows.md、packages/weapp-vite/dist/docs/mcp.md。
2. 先调用 workspace_catalog，确认工作区、可用包、脚本和文档入口。
3. 不要使用普通浏览器截图替代小程序运行时截图；截图、对比、DevTools 日志和页面运行时检查都优先使用 weapp-vite MCP 工具。

任务 A：工作区和源码理解
1. 使用 list_source_files 或 search_source_code 找到 tdesign-miniprogram-starter-retail 的 app.json、vite.config.ts、pages/home/home.js、pages/home/home.wxml、custom-tab-bar/index.js。
2. 使用 read_source_file 读取这些文件的关键片段，概括首页路由、tabBar、TDesign 组件、mock 数据和自定义 tabBar 的关系。
3. 使用 search_source_code 搜索商品列表、购物车、用户中心相关入口，输出 5 个最关键文件路径。

任务 B：脚本和 CLI 验证
1. 使用 run_package_script 或 run_repo_command 执行该 app 的最小构建验证。
2. 使用 run_weapp_vite_cli 检查 weapp-vite CLI 是否能读取目标 app 配置，并确认 MCP 已启用自动启动。
3. 如果命令失败，只做最小诊断：输出失败命令、关键错误、下一步建议，不要改代码。

任务 C：DevTools 和页面运行时巡检
1. 连接微信开发者工具；如果连接失败，调用 recover-mini-program-connection 的思路进行恢复诊断，并说明需要用户确认的 DevTools 服务端口状态。
2. 路由到 pages/home/home，读取 active page 和 page stack。
3. 使用 weapp_runtime_wait_node 等待首页核心节点出现，再用 weapp_runtime_find_nodes 查找商品卡片、tabBar 项和搜索入口。
4. 对至少 1 个节点读取 markup、attrs、styles、measure 信息。
5. 读取当前页面 state；如果有安全的非破坏性字段，演示一次 page state 更新，然后恢复原值。
6. 找到 custom-tab-bar 组件，读取 component state；如果可安全修改选中态，演示一次组件 state 更新并恢复。
7. 尝试点击“分类”“购物车”“我的”tab，分别读取页面栈或 active page，确认路由切换是否正常。

任务 D：截图、对比和日志
1. 使用 take_weapp_screenshot 对 pages/home/home 输出截图到 .tmp/tdesign-retail-home.png。
2. 如果 .screenshots/baseline/tdesign-retail-home.png 存在，使用 compare_weapp_screenshot 输出 diff 到 .tmp/tdesign-retail-home.diff.png；如果 baseline 不存在，只说明跳过对比并给出创建 baseline 的建议。
3. 使用 weapp_devtools_console 或 weapp-vite ide logs 能力读取最近日志，按 error/warn/info 分类摘要。
4. 使用 weapp_devtools_capture 再截一次当前页面，和 take_weapp_screenshot 的结果说明差异和适用场景。

最终输出格式：
1. MCP 能力覆盖清单：逐项勾选 workspace_catalog、source read/search、script/command、CLI、DevTools connect、route、active page、page stack、runtime node、page state、component state、tap/input、screenshot、compare、console/logs、capture、connection recovery。
2. 关键发现：最多 8 条，包含文件路径、页面路径、运行时状态和截图产物。
3. 失败或跳过项：说明原因和可操作的恢复步骤。
4. 复现命令：列出用户可手动执行的 pnpm/wv 命令。
5. 最终结论：一句话判断该 app 的 MCP 工作流是否可用。
```
