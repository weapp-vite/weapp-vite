# React 模板 HMR 基线复核

`templates/weapp-vite-react-template` 的 `react-template.impactFiles` 从 6 更新为 14，依据是主线提交 `add5d6c7f31e74e9fa2290e43891548f2a00eccc` 的两次独立实测。这里记录的是全部物理文件变化，包含 build stamp 与控制文件；没有删除或归一化这些变化，也没有调整全局阈值或允许增量。

旧值 6 来自 `e875000d6`。该提交已经支持自动选择 stateful HMR，模板配置为 `compileHotReLoad: true`、`renderMode: auto`，TSX 模板变更会重启构建。因此不能把旧值解释为 classic 模式。后续 `f321f4b2e` 为模板加入原生与 Wevu 组件互操作，增加组件和依赖产物，但没有更新这项基线。基线文件后来的顶层 `generatedAt` 更新也不代表 React 场景重新采样。

验收使用独立主线工作树及其自行安装、构建的 workspace 依赖，生产源码和 fixture 均对应上述主线提交。工具采用同一份验收 harness；[证据索引](./react-baseline-evidence.json) 保存 fixture 各文件、harness 入口及工具清单的 SHA-256，以及每轮报告摘要和全部变更路径。采集时另外保存完整输出副本，复制发生在计时区间之外，不改变计算文件变化的方法。

| 场景           | 第一轮物理变更数 | 第二轮物理变更数 | 第一轮观察耗时 | 第二轮观察耗时 |
| -------------- | ---------------: | ---------------: | -------------: | -------------: |
| React 静态模板 |               14 |               14 |      1004.6 ms |      1005.9 ms |
| 原生脚本       |                1 |                1 |        29.4 ms |        28.7 ms |
| 原生样式       |                2 |                2 |       345.4 ms |       345.2 ms |

两轮均完整执行三个场景，更新与恢复检查均通过。实际 runtime 为 stateful，React 变更的交付方式为 server restart。严格命令都因旧的 `14 > 8` 阈值退出 1；这些局部主线结果不表示最终 PR 或全量 IDE 验收通过。`observedMs` 是观察耗时，不冒充编译 profile 的 `totalMs`。

原生样式的额外变化是主线既有问题：组件 JSON 从含 `component: true` 变成只含 `options.multipleSlots`。该文件的首屏、React 更新前后和原生脚本更新前后都完整，在样式快照后丢失声明。这项变化没有纳入正常基线；`native-style` 的基线仍为 1，需要在候选提交上独立验证修复。

复核命令在相同工具版本下执行两次，每次启动全新的 dev 进程；环境变量通过运行环境设置，避免依赖特定 shell 语法：

- `WORKSPACE_HMR_SCOPE=templates`
- `WORKSPACE_HMR_FILTER=templates/weapp-vite-react-template`
- `WORKSPACE_HMR_MODE=full`
- `WORKSPACE_HMR_FAIL_ON_ERROR=1`
- `node --import tsx scripts/audit-workspace-hmr.ts`

这份记录只更新有实测依据的 React 场景，不推断其他历史基线的运行身份，也不以候选代码的结果覆盖主线对照值。
