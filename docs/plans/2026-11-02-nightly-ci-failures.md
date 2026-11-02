# Nightly 发布测试与性能失败归因

## 原始运行

两次运行均基于 `33ca1b4b00c8f4965180a2dc38c803c605af3542`，attempt 为 1：

| 运行 | 原始证据 | 结论 |
| --- | --- | --- |
| [Release 41372745532](https://github.com/weapp-vite/weapp-vite/actions/runs/41372745532) | `Publish nightly` job、`nightly-41372745532-1` artifact | `test:packages` 中 automator 生命周期测试超过默认 5 秒；snapshot 状态仍为 `planned`，本轮尚未上传包 |
| [Nightly Performance 41359802161](https://github.com/weapp-vite/weapp-vite/actions/runs/41359802161) | `performance-nightly-summary` 及对应分片原始报告 | 同时存在真实性能回退、历史基线采集失败及基线功能预算越线 |

实施前已将主线快进到 `19a863b39e51047029d76d0d22535a3bb3821d2e`。该提交改动了编译和监听生命周期；旧性能热点不能直接当成最新主线的源码根因。

## 确定性修复

automator 生命周期测试通过 headless provider 动态加载 simulator 源码。此前首次模块加载、两次项目启动和生命周期断言共用测试的默认 5 秒预算，且两次启动位于资源保护范围之外。独占运行故障提交时两个 case 均通过，因此不能把 CI 超时唯一归因于模块转换。

测试现在在独立的 30 秒 suite setup 中加载真实 simulator，生命周期 case 保留原默认 5 秒预算。每个成功获取的 session 立即登记；第二次启动失败时仍释放第一个 session。只有 session 结束后才删除 fixture，清理错误和仍需诊断的 fixture 均保留。生产启动逻辑和公开 API 不变。

性能报告增加实际 runtime 和失败来源诊断。可信汇总从原始样本、采集错误、门禁和功能预算重算，不使用 artifact 自报的派生诊断作判断。缺少实际管线字段的旧报告显示未知。诊断不改变计时、采样顺序、样本数量或通过规则。

## 仍保留的性能失败

- 固定基线仍为 `e7862e61dd83e3b9e356ac1e176267b31ab298af`。Wevu classic 的 sitemap 超时在三个 OS 均发生于基线；旧基线侧车监听向 Chokidar 5 传入 glob，与已记录的历史监听缺陷一致。保留原始 incomplete 证据，不修改历史源码或删除场景。
- Windows 原生 stateful 的第 9 对、macOS 原生 stateful 的第 16 对，以及 macOS Wevu stateful 确认阶段的第 14 对，均在基线等待 patch batch 及恢复时超时。候选没有相同采集错误。
- 微信目标目前按 `ide-classic-handoff` 安全契约在启动时使用 classic，旧基线仍执行 stateful。Ubuntu 原生脚本首编辑 P50 为 139.58 → 498.59 ms；原始 20 对样本确认两侧实际管线不同。保留原有对照和失败，不撤销宿主保护。
- classic 存在独立的真实性能回退。Ubuntu TDesign 的 app-json 首编辑 P50 为 508.52 → 637.49 ms，bundler P50 为 383.59 → 552.63 ms，而 watch-to-dirty 仅为 9.46 → 10.26 ms。原始热点位于入口加载、自动导入、布局和发射；嵌套阶段不可相加。后续优化须在最新主线重新定位。
- macOS auto-build 的跨提交比较全部通过，但基线 1 组件重复构建的自动导入成本为 +511.82 ms / +29.44%，同时超过 200 ms 和 25% 预算。既有预算约束两侧，继续保留该失败。

本轮保留三 OS、27 分片、构建 7 对 / HMR 20 对、唯一等量确认、跨提交 5% 门槛及两侧功能预算。没有重新采集完整性能矩阵，也不将原始失败改成通过。

## 验证与交付边界

验证覆盖 automator 单文件及包级测试、包级类型、性能诊断和可信汇总回归、改动路径 ESLint。发布前质量检查按 `repoctl.config.ts` 中原有八个 `qualityScripts` 的顺序分别执行，不改配置或缩减清单。

原生 nightly dry-run 在真实 Actions 身份下只检查来源、版本计划及 registry 状态，会在质量检查、构建和上传之前返回，因此另行记录其结果，不能用它证明质量链通过。实际执行结果保存在本任务状态索引，并在交付时说明限制。

本轮定向验证通过：automator 单文件 4 项、完整包 401 项、性能诊断与汇总 33 项，以及相关类型检查和 ESLint。原发布质量链的 `test:release`、三个契约检查、`lint`、`ci:release` 均通过；`test:packages` 的 42 个任务中 41 个成功，`weapp-vite` 有 27 个文件、46 项测试失败，涉及原生监听、构建等待和快照差异。随后单独补跑 `test:types`，86 个任务均通过，不能据此把质量链记为通过。

完整包测试结束后，单独复核未改动的 `devProvider.integration.test.ts` 中 sibling 首次保存场景：native 分支仍失败、polling 分支通过。该结果缩小了观察范围，但没有确定上述所有失败的共同根因；本轮不修改产品监听策略、测试预算或快照来求通过。

此次为测试与内部诊断改动，无产品 changeset 或 `create-weapp-vite` 联动；不恢复 npm 发布、不扩展真实 stateful 能力。Nightly 后续仍可能因上述历史阻塞和真实性能回退失败。
