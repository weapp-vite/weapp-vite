# Rust 性能证据归档与审阅入口

PR #1175 的原始证据固定保留在提交 [`09139d378`](https://github.com/weapp-vite/weapp-vite/tree/09139d378d16db2d0e82ad632e8790f4372fa208)。当前分支只保留文字报告和实现代码，移出本 PR 新增的 **4,905 个机器生成数据、历史诊断补丁及配套复算文件**，共 **44,774,816 字节**。提交历史未重写，原始样本、失败记录、source map、日志、哈希及复算门禁均可从该快照取得；清理不改变任何性能判定。

## 先读结论

- [Rust 正式构建/HMR 验收](./2026-10-11-rust-batch-production/README.md)：整体门禁未通过，native 继续默认关闭。
- [JS 架构正式验收](./2026-10-12-build-architecture-performance/README.md)：目标构建达标，HMR 仍有稳定回退；不能归为 Rust 收益。
- [实际编译入口局部分析](./2026-10-12-native-batch-transfer/README.md)：局部收益及小脚本开销并存。
- [当前显式缓存构建诊断](./2026-10-12-explicit-cache-build/README.md)：四对冒烟，不能代替正式验收。

## 原始文件索引

下列链接均绑定完整 commit SHA。文件数和字节数只统计本次移出 diff 的文件，不包含保留的 Markdown。集合摘要按路径排序，将每项 `路径 + NUL + 文件 SHA-256 + NUL + 字节数 + LF` 拼接后计算 SHA-256；原快照的逐文件 manifest 仍保留原协议。

| 历史目录 | 移出文件数 | 字节数 | 集合 SHA-256 |
| --- | ---: | ---: | --- |
| [docs/plans](https://github.com/weapp-vite/weapp-vite/tree/09139d378d16db2d0e82ad632e8790f4372fa208/docs/plans) | 22 | 2,563,659 | `72f8f52f960720db8c98c428b1772ac0987244293a3baeb833c5cf1259a0b268` |
| [2026-10-11-build-startup-followup](https://github.com/weapp-vite/weapp-vite/tree/09139d378d16db2d0e82ad632e8790f4372fa208/docs/reports/2026-10-11-build-startup-followup) | 8 | 1,083,816 | `4f7d6c15817e561774834fbdf4bf797f07db4f11ecc458fffb7c103bd5d3b79a` |
| [2026-10-11-rust-batch-production](https://github.com/weapp-vite/weapp-vite/tree/09139d378d16db2d0e82ad632e8790f4372fa208/docs/reports/2026-10-11-rust-batch-production) | 7 | 3,935,213 | `04dfd811294e8ccb2221b049fffb5b2c6ddca5be4692bc63506fa9ccbcb026c0` |
| [2026-10-12-build-architecture-performance](https://github.com/weapp-vite/weapp-vite/tree/09139d378d16db2d0e82ad632e8790f4372fa208/docs/reports/2026-10-12-build-architecture-performance) | 4,818 | 18,226,361 | `db6bbd9d7343845869c2fcd0fc406e6f7ab23dea68de2dcaa1ca5a217ee8b6c4` |
| [2026-10-12-compile-cache-flush-diagnostic](https://github.com/weapp-vite/weapp-vite/tree/09139d378d16db2d0e82ad632e8790f4372fa208/docs/reports/2026-10-12-compile-cache-flush-diagnostic) | 3 | 3,247,640 | `35ed990c733fce1d005c60bd6d388dc22ef007e9059ed1673e76a8ac5dc90162` |
| [2026-10-12-explicit-cache-build](https://github.com/weapp-vite/weapp-vite/tree/09139d378d16db2d0e82ad632e8790f4372fa208/docs/reports/2026-10-12-explicit-cache-build) | 5 | 199,510 | `0c8e4c119d58ed9752bf42db9b35bce97b39ac9d2ab62bfe3cffa13a2f97763f` |
| [2026-10-12-hmr-watcher-boundary-diagnostic](https://github.com/weapp-vite/weapp-vite/tree/09139d378d16db2d0e82ad632e8790f4372fa208/docs/reports/2026-10-12-hmr-watcher-boundary-diagnostic) | 9 | 5,176,448 | `bd2a514780150eee0b9172e5b061fb79fd2349d30b85b243a4f50374d7e521d7` |
| [2026-10-12-layout-discovery-smoke](https://github.com/weapp-vite/weapp-vite/tree/09139d378d16db2d0e82ad632e8790f4372fa208/docs/reports/2026-10-12-layout-discovery-smoke) | 5 | 325,608 | `c0759f8e3fb42ea0c65f02ccc2dee528e9558b1ab673700065ef03cb073aa20e` |
| [2026-10-12-lazy-wxs-config-smoke](https://github.com/weapp-vite/weapp-vite/tree/09139d378d16db2d0e82ad632e8790f4372fa208/docs/reports/2026-10-12-lazy-wxs-config-smoke) | 7 | 175,039 | `65e03684ee8df17af23ec72ae456217e38580fb0a6226b9e50dc9d6fa0fea439` |
| [2026-10-12-lazy-wxs-loading-diagnostic](https://github.com/weapp-vite/weapp-vite/tree/09139d378d16db2d0e82ad632e8790f4372fa208/docs/reports/2026-10-12-lazy-wxs-loading-diagnostic) | 4 | 176,809 | `91f3313afc20c22381c90bbf1c50edaa1fb77118596d20ca0a7733c880767952` |
| [2026-10-12-native-batch-transfer](https://github.com/weapp-vite/weapp-vite/tree/09139d378d16db2d0e82ad632e8790f4372fa208/docs/reports/2026-10-12-native-batch-transfer) | 3 | 494,732 | `1e2a5e3edfebe22915569c748152d376b71de0b1f916417684a3c9b3ab7f2073` |
| [2026-10-12-native-restore-attribution](https://github.com/weapp-vite/weapp-vite/tree/09139d378d16db2d0e82ad632e8790f4372fa208/docs/reports/2026-10-12-native-restore-attribution) | 14 | 9,169,981 | `7be08024039467bab4cd865a87a336649091842e1c8ddc35f98fd1561c303832` |

## 离线复算

报告包的 manifest 同时校验 README、tooling 和数据。必须在完整历史快照内运行原复算入口，不能把旧 manifest 与当前摘要混用，也不能删除校验项来获得通过。使用一个尚不存在的本地目录：

```sh
git fetch origin 09139d378d16db2d0e82ad632e8790f4372fa208
git worktree add --detach .codex-tmp/rust-evidence-09139d378 09139d378d16db2d0e82ad632e8790f4372fa208
cd .codex-tmp/rust-evidence-09139d378
pnpm install --frozen-lockfile
node --import tsx docs/reports/2026-10-12-build-architecture-performance/tooling/replay.mts docs/reports/2026-10-12-build-architecture-performance
node --import tsx docs/reports/2026-10-11-rust-batch-production/replay.mts
node --import tsx docs/reports/2026-10-11-build-startup-followup/replay.mts
```

这些入口复算已有证据，不发起新的构建/HMR 性能采样。其他历史诊断按照该快照相应 README 查看。完成后回到原工作树，用 `git worktree remove .codex-tmp/rust-evidence-09139d378` 清理自己创建的快照；如有本地修改，先保留修改。

公开包的既有限制仍适用：完整原始 emitted JS 和冻结依赖未全部发布，部分 map/log 已脱敏。历史数字不是当前 head 的性能承诺，清理证据文件也不表示全项目提速、真实宿主验收或全部 CI 已通过。

后续采样的大体积原始数据放在本地忽略目录或专门的 CI artifacts；代码 PR 保留必要摘要、来源、哈希、可访问链接和复算方法。
