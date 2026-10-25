# Chokidar 依赖契约

正式入口只读取当前安装的 `chokidar`，固定运行 29 个场景中的全部适用项，不接受候选入口、场景筛选或超时覆盖参数：

```sh
node --import tsx scripts/dependencyContracts/chokidar/run.mjs --report .tmp/dependency-contracts/chokidar.json
```

`pnpm test:dependency-contracts` 通过现有 `run-e2e-commands` 串行入口运行本契约；直接执行也取得同一机器租约。临时根在创建后解析一次真实路径，避免系统临时目录别名与 native 后端的物理路径产生不同归属。每个场景使用独立 Node 进程，借用父入口派生的非 IDE scope。普通 worker 环境剥离正式 IDE journal，不能把依赖测试资源登记到真实 IDE journal。报告记录实际宿主、模拟平台、安装版本和发行文件哈希；模拟 `process.platform` 的结果不能代替真实 Windows CI。

## Chokidar 6 的观测边界

场景 ID 延续原有 29 项，以便比较历史报告。Chokidar 6 重写了后端和协调流程，因此私有资源断言随实现迁移，公开的删除、重建、下一次写入、共享所有权和关闭要求保持有效：

- 原生文件由父目录资源及精确 candidate 协调观察；直接监听同一文件的两个 owner 共享父目录资源。macOS 还可能取得一次性的精确文件 fallback。inode 替换后要求两个 owner 都能继续收到真实写入，并验证一个 owner 退出不会关闭幸存 owner 的资源；不要求创建替换文件句柄。
- 删除通过目录成员关系和 tree entry 身份提交，不再存在 `remove` 冷却计时器。文件、目录和子项仍须完整产生 unlink/add/unlink，旧扫描和旧 stat 不得提交到新的 tree entry。
- polling 使用 Chokidar 自己的异步 stat 和 scheduler timer，不使用本库的 `fs.watchFile`。observer 注入一个共享 scheduler，保留真实计时器、原 stat Promise 和 Error，并记录 timer、pending read、interval 和 persistence。关闭必须取消本库拥有的 timer 并排空已执行的读取，独立 `fs.watchFile` 和另一项目不受影响。
- root 恢复和单 owner inode 场景显式覆盖 `backend: 'auto'`；其他原生场景显式使用 `native`，轮询场景使用 `polling`。recursive 后端的原生关闭还由资源单测覆盖。

原生 observer 保留真实 `fs.watch` 的 receiver、参数和返回值，只旁路观察回调、公开关闭和捕获的底层关闭完成。Darwin/Windows 的 FSEvent handle 同时要求精确的原生完成证据；Linux recursive wrapper 则要求它实际取得的全部子句柄终结。未知原生形状、丢失回调、重复关闭、强制收尾和观察异常均失败。Windows namespace 只在观测路径归属中归一化，原调用参数和原 Error 保持不变，分类不折叠大小写。

macOS 上 `fs.watch` 返回和公开 `ready` 不保证目录事件流已准备好。需要首次目录通知的场景使用 fixture 根目录独立原生 watcher 的精确关闭完成作为当前 libuv 的准备门禁，辅助资源单独登记；不补发回调、不重试写入，也不把该实现边界称作通用 Node readiness API。重建的子目录需要自己的准备门禁。

## 异步阶段与 atomic

首次 `add` 前安装事件阶段 observer。v6 观察原目录 reconciliation 回调的 Promise、拒绝和 epoch，并等待目标的 watch/change 节流自然结束；原回调的 receiver、参数、返回 Promise 和 Error 身份均不改变。owner 范围的协调工作全部排空且一个 turn 内 epoch 不变后，才开始独立的下一次写入。关闭后同样等待已观察任务结束，旁路拒绝单列为 `listenerFailures`。不清除原节流、不固定 sleep，不承诺操作系统未来不会再交付旧通知。

该门禁仅用于 `atomic: false` 且未开启 `awaitWriteFinish` 的阶段。atomic 使用单独的因果 observer，关联真实原生通知、目录 reconciliation、文件 stat 代、原始 `emitEvent` 和全部公开事件。替换文件在 watched 目录外预先写完，再以真实 rename 放到原路径。

atomic 场景持有精确 pending entry 的原始 scheduler timeout：一次 unlink 进入缓冲，一次 ADD 消费同一 entry 并恰好转换为一次 change，独立释放原 flush 后不得再产生公开输出。独立 change 必须有目标文件通知、正确文件代和最终 stat 的证据，一个原始 emit 或同一通知不能解释重复输出。observer 不过滤事件；公开 close 和异步 settlement 完成后才作最终核验。

## 场景覆盖

- 精确 Windows `EPERM/watch` 注册失败且路径已消失时恢复；覆盖 root、递归子项、cwd、depth、ignoreInitial 和 auto 后端。
- 原生平台、非 Windows、现存路径、错误 syscall/path、仅大小写不同的 path、EACCES、presence probe 失败的负控，均核验同一原始 Error 透传。
- root readdir 或 child stat 暂停时关闭；父目录已 unlinkDir 后释放旧子项读取；替换目录先于旧 listing 返回。v6 原生事件直接协调 candidate，旧 listing 场景用 polling 目录扫描触发同一个读取边界。
- 两个 owner 共享资源，兄弟注册失败或关闭一个 owner 后，另一个继续观察真实写入。
- 文件、目录和子项删除、重建、再次删除；atomic unlink/add 合并与旧 flush 的独立释放。
- 同一 owner unwatch/add 新 root 后，原 root 的真实 ENOENT 延迟返回不能移除新文件；两 owner 的独立读取中，另一个已看到替换 inode 后，迟到 ENOENT 也不能发布 unlink/add。
- POSIX 同文件系统真实 inode 替换与后续写入，直接文件共享资源、一个 owner 退出后的幸存者和精确最终关闭。Windows 的 inode 场景明确记为不适用，不计入通过数。
- polling 的 change/unlink/add/change，120ms 非持久订阅升级为 100ms 持久订阅，分别关闭旧 owner 或升级 owner；同步 add/ready 内 close/unwatch 保留其他 owner。

后续写入使用更长的 `r+` 内容并匹配目标新文件大小，再核验最终文本，避免旧 stat 冒充目标写入。读取门禁只控制真实读取及原对象交还，不人工调用产品 listener。

## 清理和证据

worker 先释放本场景门禁、幂等关闭全部 public owner、等待已观察异步任务和原生资源终结，再恢复 mock 并删除自己的 fixture。supervisor 不修补 worker 临时目录。清理无法确认时立即停止后续场景，封存独立 scope 并保留现场，交由核对精确 cleanupKey 的恢复流程处理。

报告包含 `index.js`、`backend.js`、`policy.js`、`reconcile.js`、`runtime.js`、`tree.js` 和 `package.json` 哈希，worker 与 supervisor 必须一致。超时、中断、强制关闭、资源证据缺失或删除失败均不能计为通过。
