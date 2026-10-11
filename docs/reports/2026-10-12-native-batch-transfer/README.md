# 2026-10-12：批量 native 分析的实际编译入口复核

> 原始采样、压缩数据与复算工具已移至[固定历史证据](../rust-performance-evidence.md)，不再纳入当前 PR 的文件差异。下文数字与限制保持原记录；复算前须按索引说明检出完整历史快照。

本轮以相同代码的 native off/on 为配对两侧，直接调用生产 `compileVueFile`。零售详情暖编译 P50 降低 **18.36%**，Wevu 首页降低 **5.61%**。10 个案例各完成 40 对交替采样，完整返回对象、map、警告和支持的错误字段比较通过。

这是**局部真实编译收益**。小脚本和错误场景仍有开销，不构成构建/HMR 或全项目性能验收，也不能撤销此前正式端到端门禁失败。native 继续默认关闭。

## 实现及归因边界

- Rust 在已有共享 AST 上重新应用通用脚本分析的需求判定。无 require、平台 API、指定 feature 分析或滚动诊断需求时，返回既有空通用摘要，省去空遍历；编译器宏、静态组件、默认导出及 surrogate 检查仍完整执行。测试计数仅编译进测试版本。
- JS 在单次 batch 前按完整源码和解析文件名去重。相同内容但不同 JS/TS/JSX/TSX 模式不合并；返回后各角色独占可变摘要容器。失败结果按角色走原回退，有效相邻结果保留，没有跨次缓存或重复请求。
- 零售脚本使用 `wpi.*`，符合跳过通用遍历的条件；Wevu 首页包含 `wx.navigateTo`，仍执行相关遍历。这里是代码路径解释，尚无 native visitor 的独立 CPU 归因。
- 本次对照是当前 native off/on，**不是上一个 native 实现与当前实现的对照**。不能将相对历史报告的百分比变化归因于这两个改动。
- 固定 10 个性能案例中，预处理后 `define-options` 仍传入 2 份不同源码、198 bytes；本轮未观察到其输入从 2 份降为 1 份。此组性能数据不能证明 JS 去重带来的耗时收益。

## 方法与结果

Node v24.18.0，macOS arm64，16 个逻辑 CPU。采样时间为 2026-10-11 21:30:34–21:31:29 UTC（本地 10 月 12 日）。每对两侧均启动独立 worker，按 AB/BA 交替；每个 worker 按固定顺序处理 10 个案例，各预热两次后测量完整编译调用。共 80 个 timing worker、800 次计时调用。另有独立 off/on/fault 诊断 worker，不混入计时。

负值表示 native 更低。RSS 是编译后 worker 快照，单位 bytes 的原始数据保留在 JSON；不是峰值或进程树内存。JSON 的通用统计字段沿用 `MedianMs` / `P95Ms` 命名，`rssBytes` 下实际单位为 bytes。

| 案例 | off P50 ms | on P50 ms | P50 变化 | P95 变化 | RSS P50 变化 |
| --- | ---: | ---: | ---: | ---: | ---: |
| wevu-home | 15.658 | 14.780 | -5.61% | -7.71% | -2.91% |
| retail-detail | 30.901 | 25.226 | -18.36% | -21.93% | -0.76% |
| define-options | 0.937 | 0.923 | -1.48% | +1.74% | -0.75% |
| dual-script | 0.683 | 0.686 | +0.40% | +6.16% | -0.77% |
| no-default-export | 0.196 | 0.206 | +5.27% | +22.00% | -0.58% |
| imported-components | 0.770 | 0.737 | -4.33% | +18.91% | -0.58% |
| options-api-components | 0.370 | 0.278 | -25.01% | -18.39% | -0.59% |
| escaped-string-components | 0.607 | 0.643 | +5.92% | +2.55% | -0.57% |
| invalid-template | 0.174 | 0.187 | +7.74% | +16.44% | -0.55% |
| invalid-script | 0.069 | 0.077 | +12.25% | +20.85% | -0.56% |

同一 worker 的预热与测量逐次检查完整语义；跨 worker 通过 V8 数据快照比较，并保存 tagged outcome hash。400 组计时配对哈希全部相等；采样前后源码、AST dist、工具、输入与 addon 身份不变。P50/P95 原始值及所有配对见 [compiler-native.json](https://github.com/weapp-vite/weapp-vite/blob/09139d378d16db2d0e82ad632e8790f4372fa208/docs/reports/2026-10-12-native-batch-transfer/compiler-native.json)。

## 独立诊断

下表来自独立观察调用，不是 40 对的 CPU/GC/计数分布。每个 native on 案例均为一次 batch/一次跨界调用，off 为零。Babel 计数只覆盖 compiler wrapper，不包含 Vue/Oxc/Rust 内部 parse；输入数不能当作 parse 数。CPU 为整个进程在观察窗口的用量，重叠阶段 wall 不能相加，不能用 wall−CPU 推导等待时间。

| 案例 | native 输入数 / bytes | Babel parse off → on | traverse off → on | generate off → on | fallback |
| --- | ---: | ---: | ---: | ---: | ---: |
| wevu-home | 1 / 3192 | 66 → 65 | 155 → 153 | 9 → 9 | 0 |
| retail-detail | 1 / 11800 | 157 → 155 | 374 → 371 | 28 → 28 | 0 |
| define-options | 2 / 198 | 7 → 5 | 12 → 9 | 1 → 1 | 0 |
| dual-script | 2 / 100 | 5 → 4 | 10 → 8 | 1 → 1 | 0 |
| no-default-export | 1 / 28 | 1 → 1 | 3 → 3 | 1 → 1 | 0 |
| imported-components | 1 / 149 | 6 → 4 | 16 → 13 | 1 → 1 | 0 |
| options-api-components | 1 / 95 | 3 → 1 | 11 → 8 | 1 → 1 | 0 |
| escaped-string-components | 1 / 34 | 5 → 5 | 15 → 15 | 1 → 1 | 1 |
| invalid-template | 1 / 17 | 1 → 1 | 1 → 1 | 0 → 0 | 0 |
| invalid-script | 1 / 13 | 0 → 0 | 0 → 0 | 0 → 0 | 1 |

`escaped-string-components` 和 `invalid-script` 各有一次预期回退。独立故障注入对 `no-default-export` 观察到一次 batch、一次 fallback，与 off 的完整结果一致；没有再次调用 native。CPU、GC 条目和阶段 wall 详见 JSON 的 `diagnostics`。

### 同源角色的真实入口契约

固定性能采样完成后，用独立合成 SFC 验证跨界前去重可通过生产入口触达。普通 script 与 setup script 均为 `const title = 'same source'`，使用 TS 模式及 sourceMap；分别处在模块和 setup 函数作用域。两侧完整结果比较通过，on 实际只提交一个输入、28 bytes、一次 batch、零回退。源码/addon 身份与上述 40 对一致。见 [same-source-contract.json](https://github.com/weapp-vite/weapp-vite/blob/09139d378d16db2d0e82ad632e8790f4372fa208/docs/reports/2026-10-12-native-batch-transfer/same-source-contract.json)。

这是边界契约验证，未加入固定性能语料，也没有旧 native 版本的实测对照，不能写成已测得旧版 2 → 新版 1 的性能收益。静态检查 `apps/templates` 的 421 份 Vue 文件，只发现 3 份双 script，未发现块内容完全相同；该范围不含预处理后角色、生成物或用户工程，不能推导总命中率。

## 验证

- Rust compiler analysis 11 项及独立 scroll-only 回归 1 项通过：包含需求判定、失败 parse、同源复用、宏、require、平台 API、feature、surrogate 与滚动诊断。
- nativeAnalysis、nativeHash、nativeReservedProps 三文件共 23 项通过；覆盖索引 0、三角色可变容器隔离、解析模式、精确源码、部分失败、原宏 Babel 回退仅一次。
- 实际默认 feature release addon 的 compilerAnalysis、scriptAnalysis、reservedPropsParity、onPageScrollParity 四文件共 104 项通过。
- `@wevu/compiler` typecheck、test:types:check、限定 ESLint 通过。按顺序重新构建 ast-native、ast、compiler、weapp-vite 后执行本轮实际入口采样。
- 修改的两个 Rust 文件按 Cargo edition 2024、`skip_children=true` 通过 Rustfmt。整 crate 检查仍存在未触及 experimental 模块的既有格式差异，不声称全 crate Rustfmt 通过。
- 默认关闭实验不新增 changeset；本 PR 既有默认 JS 行为 changeset 保留。大于 300 行的 `lib.rs` 和既有测试文件仅增加相邻 guard/覆盖；未为本轮改动搬移既有 Rust 模块。

复现采样（先按仓库规则检查活动任务并取得机器级串行 lease）：

```sh
pnpm --filter @weapp-vite/ast-native native:build
pnpm --filter @weapp-vite/ast build
pnpm --filter @wevu/compiler build
pnpm --filter weapp-vite build
node --import tsx scripts/compilerBatchAnalysis/index.ts --mode=full --native-path=packages/ast-native/index.js --output=.codex-tmp/compiler-native-profile
```

正式执行由仓库 `withMachineE2ELease` 包裹；macOS 使用 `caffeinate`，所有本任务 worker 及 lease 已释放。首次 launcher 的 Node `-e` 缺少 `--` 参数分隔，在启动任何 worker 前退出；修正启动参数后仅运行一次完整采样，没有丢弃或重采配对。

## 身份与剩余限制

- source tree SHA-256：`1a24f379fcd4e0aab491fe122addd80f0e30c2a260383d20d7d7b74c0093b4a9`
- addon identity SHA-256：`5951bd0ea56bdcef92090ebe5ee4b4b94ff21ee839c8840095260face096eda0`
- 原始 summary SHA-256：`ac2a33722e02df05456fd4448033d30443b5b597c76750967954dad6d99c9cac`

公开 JSON 为原 summary 的逐字节副本，保留输入/源码哈希、每次配对和诊断；完整 V8 结果、原始错误栈、job 和二进制保留于私有证据，未作为可独立重放包发布。依赖身份包含 lockfile，但没有穷尽每个安装的传递依赖文件。函数闭包通过结构和有限行为探针比较，不能证明任意函数等价。

本轮不覆盖冷启动、完整构建、HMR、真实小程序宿主或跨平台执行；后两项仍需 PR 对应 CI 和后续验收。此前 Rust 正式端到端目标未达标，JS 架构候选仍有 HMR/RSS 回退。不能扩大默认 native 覆盖，也不以重跑未改变根因的完整采样代替归因。
