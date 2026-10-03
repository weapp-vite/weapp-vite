# #1058 / #1136 验证记录

这份记录区分编译器机制、正式性能采样、发布包构建和真实运行时验收。当前已完成工具完整性验证、发布包构建与体积归因；未将这些结果解释为真实 DevTools runtime 验收。

## #1058：共享模板标签分析

`scripts/benchmarkTemplateAnalysis` 在同一当前编译器和依赖树中恢复历史两次标签分析作为对照，只替换组件来源分析的拥有者函数。使用 10/100/1000 行完整 SFC，比较完整 `compileVueFile` 返回值与 warning。冷条件使用新进程首次编译，暖条件先编译两遍完整输入。时间和 V8 分配采样在不同进程中执行，保留 heap、RSS 与进程峰值。

完整性测试覆盖输出不同、缺失配对、重复 trial、解析次数错误和无效内存指标。`template-analysis-exploratory.json.gz` 中单轮输出 hash 完全一致，共享路径解析 3 次，历史对照解析 6 次；分配采样有效。

本轮机器有其他项目并发构建和测试，未满足正式采样的空闲窗口，因此当前样本仅证明采集流程可用，不报告提速或内存改善结论。正式采样入口：

```sh
node --import tsx scripts/benchmarkTemplateAnalysis/index.ts --trials=7 --formal --output=.codex-tmp/template-analysis-formal.json
```

## #1136：真实发布包与历史数字

源应用固定为 `weapp-vite/benchmarks@ae0ba52baa5db501d8e202b3cec9c4a888a555ff` 的 `apps/weapp-vite-wevu`，依赖使用该提交完整 pnpm 锁文件；仅将 app importer 移到独立项目根目录，依赖 snapshots 未改。`weapp-vite` 和 `wevu` 均实际安装 registry 7.4.0，Node 24.18.0、pnpm 12.8.1。原根 tsconfig 使用已核验的 repoctl 5.5.10 发布文件展开，避免向外层工作区解析配置。

消费者位于系统临时根，所有实际保留模块必须在自己的安装树内。初次将消费者放在仓库内部时，这项门禁捕获到了外层工作区模块；该轮证据作废。下列归档均来自迁出仓库并通过隔离门禁后的重跑。安装来源、锁文件 SHA-256、实际 emitted 字节与 hash、模块包归属、生成代码和引用图随 JSON 保存。探针启用前后每个 emitted 文件 SHA-256 完全一致。

| 场景 | runtime 主文件 | 备注 |
| --- | ---: | --- |
| 历史原始报告 | 170,668 B | 已找回同时匹配原始、gzip、Brotli 三项大小的文件，并补存 hash |
| 固定输入 registry 7.4.0 重建 | 170,164 B | 87 个保留模块；另有 runtime 模块进入页面 chunk |
| 最小页面 registry 7.4.0 | 165,883 B | 同一发布依赖树 |
| 典型页面 registry 7.4.0 | 170,101 B | ref、computed、onLoad、点击更新；另有 runtime 模块进入页面 chunk |

**504 B 差额来自 84 条打包器路径注释，每条多出 6 B 的 `../../`。** 原 benchmark 的 app 位于 workspace 二级目录，注释为 `//#region ../../node_modules/…`；独立消费者位于安装根目录，注释为 `//#region node_modules/…`。只删除这些行首 region 注释的相对路径前缀后，两份文件逐字节一致，SHA-256 同为 `eb23081003bb140d793104b8c8a9fab1e7a6bc33651a6dda2771f2f6b02be589`。这是输出源码注释的布局成本，不涉及运行时代码差异。

找回文件的原始字节数 170,668、Node gzip 42,012、Brotli 35,344 均与历史报告一致。历史报告未记录文件 hash，因而仍保留这一来源限制；本轮已将找回文件、独立消费者文件以及完整比较结果分别保存为 `recovered-170668-runtime.js.gz`、`published-7.4.0-benchmark-runtime.js.gz` 和 `historical-runtime-comparison.json.gz`，供后续逐字节复核。找回文件 hash 为 `38b55d82531819afd34e9daf56a935c22f0615138def7fe1b53802510cc1b243`。

170,668 B 的来源可以据此拆为：运行时模块估算 164,487.68 B、其他依赖估算 2,122.68 B、共享 helper 估算 3,553.64 B，以及精确的目录路径注释差额 504 B。前面三项来自 87 个实际保留模块的比例估算，合计 170,164 B，另列未归因份额为 0 B；比例估算并不证明不存在 wrapper 成本。完整模块、引用链和类别见消费者 JSON，不能将估算误称为模块独立压缩字节。

体积分配复用现有 analyze 的 `rendered-length-proportional` 方法：最终文件字节按 bundler 模块长度占比分配，提供未归因份额；它不是每个模块的独立压缩字节。`facets` 进一步分出 wevu 内部响应式、宿主适配及可选能力。保留 `routeSync` 或 `bindModel` 的事实不能推导为完整 router/store/layout 均被引入，必须查看实际模块和引用链。

重现准备和验证：

```sh
node --import tsx scripts/runtime-size/preparePublishedConsumer.ts --install
node --import tsx scripts/runtime-size/verifyConsumer.ts <上一步输出的独立消费者目录> --disposable-consumer
```

需要网络代理时按 Node 的环境代理配置运行准备命令。准备器固定公开源提交、锁文件和 repoctl tsconfig 的 SHA-256；验证器保留源码备份，并在成功或失败后恢复源码及配置。它校验 benchmark、最小页面和典型页面构建，不启动 IDE，也不宣称页面运行时行为通过。

已安装候选 `@mpcore/test` tarball 的独立消费者可额外传入 `--runtime=headless`。验证器通过消费者内部的 ESM 解析加载自身 `node_modules` 下的测试包，记录版本、入口相对路径与 SHA-256；每次最小/典型场景构建后显式指定 `dist/app.json` 和产物根创建测试项目。最小场景验证文本，典型场景将原来的 `view` 改为可按角色查询的 `button`，验证 `onLoad` 后 `1 / 2`、点击后 `2 / 4`，并在 `finally` 关闭会话。本次场景源码及适配说明、逐场景观察值和关闭结果写入 `verification.json`；失败会保留已有观察值并标记未完成，不沿用上次通过结果。未传入此选项时维持原场景，不要求安装测试包。此入口只提供 headless 辅助证据，报告始终明确真实 Stable 微信开发者工具尚未运行、最终 runtime 验收未完成。

## 当前七端能力阶梯

`seven-target-capabilities.json.gz` 保存当前工作树已有 dist 的七端 × 七阶梯数据。原预算及禁入模块门禁全部通过，未提高预算。JSON 新增每阶梯实际生成入口、明确比较基线、整体与模块字节差、保留/移除模块、模块引用链、类别与未归因字节。公共入口和内部入口的差值是入口兼容成本比较，不是新增业务能力成本。

| 微信阶梯 | Production | 比较基线 | 增量 |
| --- | ---: | --- | ---: |
| reactivity-core | 6,560 B | 起点 | — |
| minimal-app | 79,236 B | reactivity-core | +72,676 B |
| typical-page | 122,683 B | minimal-app | +43,447 B |
| complex-component | 137,265 B | typical-page | +14,582 B |
| public-app | 158,101 B | minimal-app | +78,865 B |
| public-page | 160,017 B | public-app | +1,916 B |
| full-provider | 256,541 B | complex-component | +119,276 B |

```sh
node --import tsx scripts/report-wevu-runtime-size.ts --check --output-json=.codex-tmp/runtime-capability-attribution.json
```

当前候选 tarball 的独立消费者验证、#1058 正式采样和真实 runtime 验收仍需在各自前置条件满足后补齐；本记录不把它们标为完成。
