# 微信 IDE DOM 验收规范

## 验收范围

以 `e2e/scripts/e2e-suite-manifest.ts` 的 `ide-full:exhaustive` 为唯一任务来源。89 个任务中的 3 个可选百度任务列为范围外，其余 86 个微信任务以及 aggregate 导入、参数化变体、多路由场景全部纳入验收。已有组件库和人工 IDE 示例排除范围不变。

任务数不等于 case 数。Vitest 收集树展开后的 case、模板格式子进程和每个 case 声明的检查点共同构成执行清单；报告必须保留未执行项。

## Case 合约

每个 case 通过 `createDomAcceptance` 独立登记 fixture、路由、操作和顺序固定的命名检查点。期望值来自业务测试设计，不能从生成产物或本次运行结果反向推导。

- 首屏和关键操作后检查节点文本、属性、数量、出现或消失。
- 样式验收使用真实 IDE 的计算样式和布局尺寸。headless 逻辑树不提供布局通过证据。
- HMR 验收检查新界面和应保留的交互状态，不能只检查文件更新或运行时数据。
- API/lifecycle 场景保留语义断言，并通过 fixture 界面展示执行结果。
- `page.data`、`runE2E().ok`、dataset、根节点存在和构建文件均不能单独完成渲染验收。
- DOM 查询关闭 AppService fallback。协议异常、缺失查询能力不能转换为“节点不存在”。

真实 IDE 将自定义组件呈现为 generic component 的场景，通过稳定后代节点确定组件 scope。节点消失必须在正确的 scope 内验证，不能查询不存在的组件标签得到空数组后记为通过。

## 运行和证据

本机所有 E2E 全局串行，同一 app/suite 复用 automator，以 `reLaunch` 切页。必须完整重载的 HMR 或冷启动 case 写明原因。长任务通过睡眠抑制器保持系统唤醒。

修改包源码后先重建对应 dist，再验证下游。CLI 相关验证固定先运行 `pnpm --filter weapp-vite build`。

报告记录 provider、提交 SHA、工作区是否存在改动、IDE/基础库版本、逐 case/checkpoint 证据及截图索引。证据保存在本机 `docs/reports/dom-acceptance/`；GitHub 仅引用脱敏摘要和仓库相对路径。

严格模式由 `WEAPP_VITE_E2E_DOM_ACCEPTANCE=1` 启用；`ide-full:exhaustive` 自动启用。缺少计划、检查点、skip/todo、运行中止、环境阻塞或未跑完均不能成为通过。筛选运行标为 partial，不能作为全量验收交付。

## 交付判据

最终提交上执行无筛选、无允许失败选项的 `pnpm e2e:ide:full:exhaustive`，并完成所有适用的云端 CI 检查。后续源码修改必须重新验证影响范围，最终全量 IDE 证据需对应最终提交。审批等待、取消、未完成和宿主阻塞均保留为未完成状态。

本轮交付到中文可合并 PR，不自动合并或发布。
