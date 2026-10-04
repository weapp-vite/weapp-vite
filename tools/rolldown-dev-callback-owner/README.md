# Rolldown DevOptions 回调所有权上游草案

本目录保存针对 Rolldown 1.2.12 的可移植源码补丁和公开 API 复现器，供上游审查与回归使用。正式依赖仍未包含此修正；候选验证通过不代表 #1135 已完成，也不代表资源门禁或 npm 消费者验收完成。

## 文件与应用范围

- `upstream.patch`：相对 Rolldown 提交 `45e407b177f5885d04a9795f37f8be71d91f6f17` 的补丁，包含普通 close 错误路径的清理前置修正、回调所有权修正和 Rust 单测；仅移除草案新增的文件尾空行，Rust 语句与候选编译版一致。
- `callbackCycle.mjs`：只使用实际安装的 `rolldown/experimental` 公开 API 的独立复现器。
- `provenance.json`：上游版本、补丁及复现器 hash、修改前后源码 hash 和验证范围。

补丁保存在开发工具目录，由维护者在上游源码中显式应用。它未连接仓库安装钩子、pnpm patch/override 或运行时安装树。没有提交 native 二进制、诊断 loader、堆快照或本机原始报告。

## 根因与修正

框架宿主把 engine 保存在自身字段中，同时向 DevOptions 传入捕获该宿主的通知函数，形成引用环：native engine → DevContext → 通知 closure/TSFN → JS callback → 宿主 → JS engine → native engine。`onOutput`、`onHmrUpdates` 和 `onAdditionalAssets` 均可参与这条链；停止构建本身不会释放这三个长期回调 owner。

补丁把三回调从 normalized options 移入独立 `DevCallbacks`，构造时转移所有权而不复制。通知只在短锁内克隆 Arc，调用和析构均发生在锁外。首个 terminal close 停止并等待通知生产者后释放 store，普通 send/closeBundle 失败也经过清理，再保留原错误优先级。

`run` 在 coordinator 锁内检查 closed；close 取走未启动的 coordinator。lazy compile 在取得 bundler 锁后重新检查 closed，已准入的 compile 则持锁直到 additional-assets 入队。coordinator join 和 bundler 锁分别构成两个生产者的终止边界。公开 moduleGraph 和合法保留的 output handle 继续按原语义工作。

NAPI 3.13.0 的 TSFN Drop 使用正常 release；[Node 24.18.0 的 Node-API 合同](https://github.com/nodejs/node/blob/v24.18.0/doc/api/n-api.md#reference-counting-of-thread-safe-functions)规定正常销毁前排空队列。close 等待原生生产者完成，不等待用户 callback Promise，否则 callback 自己 await close 会形成互相等待。该合同及源码分析仍需要独立的队列回归验证，见下方未覆盖边界。

## 已核对的证据

以下均为 Node 24.18.0、macOS arm64 的局部诊断。GC 只帮助观察可达性，不用于性能或资源验收。

| 验证 | 结果 | 能证明的范围 |
| --- | --- | --- |
| 实际安装的官方 `rolldown@1.2.12`、两个独立进程、相同物理 fixture 路径和源码 | intact 去外部根后 95 轮 GC / 5013.07ms，holder/engine/graph 均仍可达；只断开 holder→engine 边的 severed 在 3 轮 / 162.96ms 全部 finalized | 相同产物下的断边阳性对照支持 callback 捕获环；有限 GC 未回收本身不单独证明泄漏 |
| 候选 native、相同 normalized-options v3 adapter、两个独立进程 | intact 保留内部边，去外部根 3 轮 / 157.545ms 全部回收；severed 3 轮 / 157.259ms 全部回收；Bundler/Factory/Driver 各 created 1 / dropped 1，deferredPending 0 | 此最小 DevOptions 捕获环已解除；两 case 输出与原诊断红对照一致 |
| 实际发布的 `rolldown@1.2.12` JS/metadata 私有副本 + 候选 native，同一最终复现器，无 adapter/loader/binding 环境覆盖 | intact 保留内部边，去外部根 3 轮 / 157.018ms 全部回收；severed 3 轮 / 155.937ms 全部回收；两个 child 正常退出，输出逐字相同 | 已通过实际发布 JS 入口观察到此最小捕获环解除；私有安装树诊断，不是正式 npm 分发验收 |
| Rust callback store 单测 | 1/1 通过，无 skip；候选 native 编译成功且源文件未漂移 | 已取得的回调 Arc 快照仍可调用，其他 owner 可释放，重复 release 安全 |
| onOutput 内部 await close | 无死锁；1 次 build、1 次 output、1 次 closeBundle；关闭后 6 个 input 和 41 个 output getter 的值与 identity 及 payload 保持一致，公开 graph 查询合法，重复 close 完成 | 已派发回调的关闭后续体合法 |
| close-before-run | run 以 `Failed to run dev engine` 拒绝；0 build/output/closeBundle，无 dist；空 graph 查询和重复 close 完成 | 关闭后不能重新准入 run |

各次候选 capability/child 均正常退出，adapter 和 getter 清单未改变，登记 fixture 已清理。官方两个 child 也均正常退出，输出代码逐字相同、hash 一致。不同执行组的 hash 只在各自输入/路径协议内比较，不跨协议强行比较。

私有安装树验证仅替换独立副本中的 macOS arm64 binding，未修改共享安装树。运行前后均核对复现器、实际发布的 JS/metadata、候选 binary、原官方 binary 和两个只读链接依赖的 hash；实验入口与平台 binding 均从私有副本解析，监督器结果为 `verified`。候选 native 的 SHA-256 及精确回收记录见 `provenance.json`。复现器本身不替换 native，也不读取 native 诊断计数；本轮实际装入的候选 binary 由外层监督器核对，因此脚本报告不能独立证明所用 binding 是官方版本。

官方复现器 v1 的首次执行因两个 child 的 output hash 不相等而中止；该轮各用独立临时路径，且未保存原始产物，差异原因无法据此确定，未计入机制证据。v2 改为相同物理路径，并在比较前保存原始报告和未经修改的 chunk code；上表官方结果来自 v2。v1 的原始日志与脚本保留在本地审计材料中。

## 运行公开 API 复现器

将 `callbackCycle.mjs` 复制到一个普通 Node 项目，在该项目安装待测的实际 Rolldown 包，再运行脚本。脚本通过自身位置解析依赖；仅从别的目录调用仓库里的脚本不会改变其解析来源。

```sh
npm init -y
npm install --save-exact rolldown@1.2.12
node callbackCycle.mjs --report official-result.json
```

`--report` 可选，指定的报告文件必须不存在。脚本拒绝 NODE_OPTIONS 注入和已知 binding 替换环境变量。父进程只创建一个登记的临时 fixture，串行两个独立 child，复用同一路径和输入；每个 child 退出后清空内容，最后移除整个 fixture。超时或 SIGINT/SIGTERM 仅终止当前仍持有的精确 child。每个 child 都是 watch=false 的单次 build。

报告保存原始 stdout/stderr、未修改的 chunk code、实际包版本、退出与清理状态。比较成功或失败都会输出 JSON；运行时生成的原始报告含本机临时路径，向公共 issue/PR 提交时使用上表式摘要。不要提交原始报告，不要 normalize 输出来制造相等结果。

`capture-cycle-supported` 表示相同输出下 intact 保留、severed 回收；`no-retention-observed` 表示两者均回收；其余为 `inconclusive`。`status: observed` 代表诊断执行完成，`acceptance` 始终为 false。官方红场景的进程可以正常退出，不能把退出码 0 解读为缺陷已修复。

## 在上游源码中验证补丁

以 `provenance.json` 中的 commit 建立干净 Rolldown checkout，按该上游版本的贡献指南安装依赖。将下面示例路径替换为本补丁的实际相对路径：

```sh
git apply --check ../weapp-vite/tools/rolldown-dev-callback-owner/upstream.patch
git apply ../weapp-vite/tools/rolldown-dev-callback-owner/upstream.patch
cargo test -p rolldown_dev dev_callbacks::tests::release_keeps_only_the_inflight_callback_snapshot_alive
```

随后依照上游构建流程生成匹配的 JS 主包和 native binding，并在独立项目安装这些实际候选包，运行同一公开 API 复现器。当前候选证据包括独立诊断 native 配合 normalized-options v3 adapter 的验证，以及保留实际发布 JS/metadata、仅替换私有安装副本 native 的公开 API 验证；两者均不等同于这个干净上游 checkout 的完整发行构建或普通 npm 安装验收。

## 尚未覆盖与发行门槛

- **已入 TSFN 队列但尚未派发到 JS 的通知**：当前只实测已派发 callback 内部 await close 的续体。还需可观测的入队/生产者 gate 证明正常 release 后恰好交付一次，payload 与公开 getters 完整。额外 sleep、忙等或假设 run/close 完成代表 JS 已派发均不构成证明。
- **真实 watcher/HMR/lazy 竞争**：本候选尚未跑在途 watcher 成功/失败 close、两个 close 竞争、HMR/additional-assets 实际通知、已准入与锁外排队的 lazy compile、run 与 close 竞争。源码边界分析不能替代这些运行结果。
- **完整资源与平台验收**：尚未覆盖完整框架 ownership 图、allocator 驻留、原用户资源阈值、全部 Node 版本、Linux/Windows/WASI 或真实小程序 runtime。保持原输入、阈值与 GC 策略后另行验收。
- **正式消费者分发**：需要上游合入并发布匹配的 Rolldown 主包、各平台 binding/WASI，Vite 的最低依赖采用修复版，再从仓库外用 npm/pnpm 安装 Vite/weapp-vite tarball。分别从 Vite 和 weapp-vite importer 核对实际 Rolldown/binding 解析结果；顶层版本或 monorepo override 不能替代此检查。

这是上游修复材料和内部诊断工具，尚未改变本仓库已发布行为，因此不添加 changeset。既有 `dev_engine.rs`、`bundling_task.rs` 超过 300 行；补丁保留其原结构，把新增 callback store 单独拆为小模块。复现器 386 行，已评估拆分；为保持可单文件复制到普通 npm 项目并按自身路径解析依赖，本次保留一个文件。内部按 observer、child 和 supervisor 函数分层。可移植版本已按仓库 ESLint 整理并改用显式 Node process、main 错误处理及等价 GC deadline 表达式；官方实测包含整理前 v2 与最终可移植版本；最终版本 hash 与 provenance 一致，再次观察到相同输出下 intact 在 96 轮 / 5046.965ms 后仍保留三对象、severed 在 3 轮 / 157.569ms 后全部回收。两个 child 正常退出、fixture 已清理，无失败。
