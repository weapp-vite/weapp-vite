# Chokidar 依赖契约

正式入口只读取当前安装的 `chokidar`，固定运行 29 个场景中的全部适用项，不接受候选入口、场景筛选或超时覆盖参数：

```sh
node --import tsx scripts/dependencyContracts/chokidar/run.mjs --report .tmp/dependency-contracts/chokidar.json
```

`pnpm test:dependency-contracts` 通过现有 `run-e2e-commands` 串行入口运行本契约；直接执行也必须取得同一机器租约。每个场景使用独立 Node 进程，显式借用父入口派生的非 IDE scope。普通 worker 环境剥离正式 IDE journal，父环境保持原样，不能把依赖测试资源登记到真实 IDE journal。

这些契约使用真实宿主文件系统和原生 `FSWatcher` / `StatWatcher`，按确定的事件门禁暂停异步读取及旧代移除冷却。`process.platform` 覆盖只用于验证平台分支，报告保留实际平台和模拟声明，不能代替真实 Windows CI。原生 inode 更替场景仅适用于 macOS、Linux 和 FreeBSD；Windows 明确记录 `non-applicable`，不计入通过数量。

macOS 上 `fs.watch` 返回和 Chokidar 初次扫描的 `ready` 不保证 CF 线程已启动目录事件流。重建目录的契约在首次修改前，用 fixture 根目录的独立原生 watcher 完成一次公开关闭，并等待它的精确原生关闭回调；当前 libuv 的 Darwin 实现会在关闭时同步重建其余目录订阅的事件流。辅助句柄与产品句柄分别登记和核验，不改 Chokidar 自身订阅、不补发回调、不重试写入，也不把这项实现边界声称为 Node 的通用公开 readiness API。原生错误仍使契约失败；后续实际 add/change/unlink 断言继续验证产品回调。报告独立记录辅助关闭证据与产品句柄的原始通知，通知超过 128 条时明确记录省略数量。空目录根 ENOENT 单测也经过同一准备步骤，并只接受本次 `queued.txt` 写入的精确原始通知，排除目录创建时的迟到事件。

atomic 冷却契约在初次公开 `ready` 后、第一次删除前执行相同门禁；重建目录的契约在新文件 `add` 后再次执行门禁，再开始后续修改和删除。父目录先前完成的门禁不能代替新取得的子目录订阅就绪。门禁失败保留原始错误，不进行后续修改；atomic unlink 缓冲、旧 remove 冷却及最终单次 change 断言保持原有时序。

所有权、重绑和恢复后的独立后续写入先经过同一个 observed-drain 检查点：在 owner 的首次 `add` 前观察精确文件 listener，保留原调用、返回 Promise 和 Error 身份；等待已观察 listener 全部结束、该文件原有 watch/change 节流自然退出，并确认一个事件循环 turn 内 epoch 不变。观察不清除计时器、不补发事件、不固定 sleep，也不改现有 stat 门禁；`cwd` 下分别按原 watch key 与相对 change key 匹配同一文件。超时、关闭或 listener 拒绝均失败，旁路观察到的拒绝独立记录为 `listenerFailures`，不伪装为 public `error`；worker 在用例完成和最终清理后均核验，不能因未调用检查点而漏报。公开 close 和读取门禁释放后，同一 observer 还须在预算内等待已登记 listener 全部结束，再生成最终失败清单；未完成时保留临时目录并报告 cleanup 失败，不能用 native close 代替异步 listener 完成证据。

该检查点只用于 `atomic: false` 且未开启 `awaitWriteFinish` 的独立事件阶段，不覆盖额外的 pending-unlink/pending-write 队列，不声称操作系统未来不会再交付旧通知，也不构成高频每次 write 必发 change 的保证。专门验证旧错误、atomic 和 remove 冷却的门禁时序保持原样。恢复和共享 owner 的后续写入使用已存在文件的 `r+` 更新并核验文本严格变长，避免引入额外的 truncate 中间阶段；change 同时要求目标新内容的文件大小，随后核验最终内容，旧 stat 不能冒充目标写入通过。这不增加文件写满稳定性或截断通知重放的契约；未通过的历史运行仍保持失败。

场景覆盖：

- 消失目录的精确 Windows `EPERM/watch` 分类，以及 root、递归、cwd、depth、ignoreInitial 行为。
- 原生平台、非 Windows、现存路径、错误 syscall、错误 path、仅大小写不同的错误 path、EACCES 和 presence probe 失败；应透传时保留同一原始 Error 对象。大小写负控是分类输入仿真，不声称本机存在两个仅大小写不同的真实条目。
- root readdir 或 child stat 暂停期间关闭；父目录删除、替换目录先于旧 listing 返回；不发布旧代子节点、不保留已销毁 stream。
- 两个 public owner 共享原生 watcher，兄弟注册失败或关闭一个 owner 后，另一个仍收到真实变更。
- 文件与目录在旧 remove 冷却未释放时重新创建并再次删除；atomic unlink/add 保持一个 change。
- 旧文件监听回调的真实 ENOENT 延迟返回，不得移除同路径的新代文件。
- 真实 inode 更替后的原生重新绑定：同一 fixture 文件系统内、watched 目录外预先准备替换文件，订阅后先排空已观察的旧事件，再登记匹配替换文件 dev/ino/size 的 change waiter 并执行 rename；原 inode 的迟到事件不能代替重绑证据。第二次写入使用更长的 `r+` 内容并核验新大小与最终文本。
- polling 的 change/unlink/add/change 和实际 stop 事件，以及同步 ADD/ready 回调中的 close/unwatch。
- polling 的 120ms 非持久订阅升级为 100ms 持久订阅，保留已有 owner 的 raw/change；分别重复关闭旧 owner 或升级 owner，随后关闭所有 public owner，同路径独立原生 listener 和另一项目仍观察真实写入，最后精确释放并确认每个 StatWatcher 的 stop。
- 两个 owner 直接监听同一真实文件，在真实 rename 替换 inode 后共享一个新原生 handle，双方收到随后真实 write 的 change；全程禁止父目录 watcher，旧 handle 与最终新 handle 均只关闭一次。该项和单 owner inode 项在 Windows 均明确记录 `non-applicable`。
- 同一个共享原生代的两个 stat 同步派发后，先冻结一个 sibling 的真实 ENOENT，另一 sibling 取得新 inode 并完成 rebind；释放原 Error 后，两者均不能发布 unlink/add，且继续收到随后真实 write。门禁只控制原生读取及交还，不人工调用 watcher 回调。
- 共享 inode rebind 后关闭并重复关闭一个 owner，新 handle 由幸存 owner 保持；后续真实 write 仍发布 change，末个 owner 关闭时每个 native handle 只 close 一次。新增两个 inode 边界在 Windows 同样明确记录 `non-applicable`。

通过要求 public close 幂等完成，并分别核验公开 `close` 事件和每个实际取得的 FSEvent 原生关闭完成。观察器捕获 `fs.watch` 返回时的同一个 `_handle`，保留其原生 close 的 receiver、参数、返回与原回调，只旁路记录真实 native close callback；不补发任何事件。正常路径仍同时要求一个公开 `close` 事件和一次原生关闭完成。Node 在底层 watch 错误后直接关闭 FSEvent、释放 `_handle`，明确不发公开 `close`；该路径必须同时具有同一捕获 handle 的实际关闭完成、原生错误和 wrapper 释放证据，不能单凭 error 或 `_handle === null` 通过。共享 inode 场景仍要求每个 native wrapper 的公开 close 调用和事件均恰好一次。报告分开记录公开调用/事件、原生请求/完成、终结路径和观察错误；重复、错误 receiver、替换 handle、原回调失败、未完成或未知/recursive native shape 均失败。未知形状也保留已取得的 wrapper 登记及精确 close 途径，不丢失资源、不自动视为已终结。

此外，所有 polling watcher 必须发出 `stop`，worker 删除自己的临时目录，并恢复所有 fs、platform 和局部门禁 mock 后释放借用登记。报告包含安装版本及 `index.js`、`handler.js`、`package.json` 哈希，worker 必须与 supervisor 一致。

超时、中断、强制收尾、缺失资源证据或删除失败均不得计为通过。supervisor 不修补 worker 临时目录；清理无法确认时停止后续场景，封存独立 scope 并保留报告和现场，交由按精确所有权的恢复流程处理。
