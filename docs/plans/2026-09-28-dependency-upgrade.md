# 2026-09-28 依赖升级记录

本轮采用兼容性优先策略，限定升级清单，不扩大公共 API 或 Node 支持范围。

## 暂缓升级

- TypeScript 保持 6.0.3。7.0.2 根入口不再提供旧 Compiler API；Volar、配置类型和代码生成脚本的迁移另行处理。
- dotenv-expand 保持 12.0.3。1000.0.0 自动支持命令替换和解密，会改变上传凭据环境文件的处理语义。

## 兼容迁移

- uview-plus 升级至 3.8.125。上游已吸收选择器、主题变量和富文本补丁；本地仅保留条码组件 getCanvasRef 等待实例 $nextTick 的修复，确保读取 refs 前宿主视图提交完成。
- Vite 与 Rolldown 保持统一依赖版本；Vitest、coverage-v8 和 browser-playwright 同步升级。
- 保留 catalog 引用、原有版本范围形式和公共 peer 兼容范围。
- MCP 2.1 的导入、传输和工具返回类型，以及 Tailwind engine 0.1.2 的扫描/增量接口，经现有类型契约、协议测试和 HMR 回归验证，无需修改调用边界。Devframe/Monaco 的现有生命周期与 worker 入口保持兼容。
- ESLint 配置升级后，将有意使用 Express 的 Socket.IO 示例纳入现有依赖规则例外，保留示例协议与演示目的。

## 升级版本

| 依赖 | 升级前 | 升级后 |
| --- | --- | --- |
| vite | 8.3.0 | 8.3.1 |
| rolldown | 1.2.10 | 1.2.11 |
| rollup | 4.63.4 | 4.63.5 |
| vitest | 5.0.1 | 5.0.2 |
| @vitest/coverage-v8 | 5.0.1 | 5.0.2 |
| @vitest/browser-playwright | 5.0.1 | 5.0.2 |
| weapp-tailwindcss | 5.5.8 | 5.5.10 |
| @weapp-tailwindcss/engine | 0.1.1 | 0.1.2 |
| devframe | 1.0.0 | 1.1.0 |
| monaco-editor | 0.56.0 | 0.57.0 |
| @modelcontextprotocol/client | 2.0.0 | 2.1.0 |
| @modelcontextprotocol/node | 2.0.0 | 2.1.0 |
| @modelcontextprotocol/server | 2.0.0 | 2.1.0 |
| uview-plus | 3.8.113 | 3.8.125 |
| @tanstack/vue-query | 5.103.2 | 5.104.0 |
| socket.io | 4.8.3 | 4.8.4 |
| socket.io-client | 4.8.3 | 4.8.4 |
| ws | 8.21.3 | 8.22.0 |
| hono | 4.13.8 | 4.13.9 |
| @icebreakers/eslint-config | 8.0.2 | 8.0.3 |
| @types/node | 26.6.2 | 26.6.3 |
| sharp | 0.35.4 | 0.35.5 |
| turbo | 2.11.3 | 2.11.5 |
| esrap | 2.3.9 | 2.4.0 |
| lint-staged | 17.5.1 | 17.6.0 |
| wrangler | 4.137.0 | 4.142.0 |
| @iconify-json/vscode-icons | 1.2.81 | 1.2.82 |

## 验证记录

- 目标依赖解析检查：27 项全部匹配计划版本；catalog 引用和原有版本范围形式保留。
- Rolldown 单版本及发布依赖检查：1.2.11。
- 6 个受影响包的 typecheck：通过。
- Tailwind、MCP、automator、Dashboard RPC 与上传环境定向单测：40 文件、362 项通过。
- 包构建：40 个任务全部通过。
- weapp-vite、Tailwind、MCP、automator、IDE CLI 类型契约测试：通过。
- ESLint、Dashboard Stylelint、依赖协议、changeset 格式和 Tailwind catalog 检查：通过。
- 根单测回归：1,271 文件、11,989 项通过；12 文件、18 项保持原有跳过状态。
- 网站构建：通过。
- 构建与 HMR E2E：6 文件、22 项通过，覆盖原生/SFC 多平台模板、共享 chunk、Tailwind v4 source、动态类及模板 HMR。
- uview-plus headless：13 个目标组件通过，覆盖条码、级联、裁剪、浮动按钮、SKU、navbar、notice-bar、富文本、subsection、switch、tag、tabs、sticky。
- headless 能力边界：真实网络套件失败于未注册 request mock，MCP 视觉套件失败于逻辑节点不提供布局/计算样式。该 provider 不提供上述真实网络和视觉能力；保留原断言，使用真实 DevTools 验证，不能将此次 headless 合并运行报告写为全通过。

- uview-plus Web：13 个目标组件在移动端和桌面端的行为、视觉基线比对全部通过（2 项聚合测试），未更新基线；同时覆盖 sharp 截图解析与比对路径。
- Dashboard 实际联调：通过 `dashboard-ui-lab dev:ui` 验证 OTP 认证、URL 中一次性凭据消费、4 个包/178 个模块的 Analyze 同步、源码读取与 Monaco 对比。确认 0.57.0 editor worker 加载，刷新及页面切换后恢复连接和两个可见编辑器；控制台错误/警告均为 0。首次自动化等待误选隐藏 gutter，改为检查可见编辑器后通过，无产品代码改动。
- 真实 DevTools：未通过验收。2.02.2609231 的 automator WebSocket 可连接，但模拟器反复报 `simulator launch failed` / `simulator not found`，并出现运行时日志订阅超时；页面停留欢迎/编译状态，路由为空。已通过 Computer Use 操作重新编译，并经历框架的清理编译缓存、重启和多轮重试，仍未恢复，随后主动终止本次合并运行。真实网络、MCP 视觉及 uview-plus IDE 场景不能记为通过，需在可正常启动的 IDE 环境补验；未弱化或跳过测试断言。

本轮 E2E 按全局串行执行：构建/HMR、headless、真实 IDE、Web，随后进行 Dashboard 联调；结束后关闭本轮浏览器、开发服务器和残留 IDE 进程。

## 执行说明

`up:pkg` 默认使用交互式 latest 更新。此次执行环境无法提供交互选择器所需的终端，且 pnpm 不允许 latest 与显式版本同时使用，因此复用升级脚本导出的命令序列，仅将第一步改为非交互的显式版本更新；去重、catalog 同步和发布依赖检查仍按原顺序执行。pnpm 展开的 catalog 引用已恢复，统一版本写回 workspace catalog 后重新安装并验证。

自动生成的重复全包 changeset 已合并，并收敛到生产依赖、构建链及固定版本组的相关包，联动 create-weapp-vite；纯测试工具升级不单独触发发布。

Catalog 门禁要求所有受影响的可发布 catalog 消费者有 changeset，因此同批包含 ast-native 的 Node 类型依赖及 glass-easel-web-adapter 的 Vite 构建依赖联动。仅 Vitest 版本变化的包不单独发布。
