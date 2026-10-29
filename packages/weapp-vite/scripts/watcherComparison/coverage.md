# 与 Chokidar 依赖契约的覆盖关系

既有权威清单为 `scripts/dependencyContracts/chokidar/scenarios.mjs`，其原生资源、读取阶段和错误分类断言见同目录 `README.md`。下面只说明新增适配层契约与这些要求的关系，不表示已执行或通过，也不表示 Parcel 与 Chokidar 的内部实现相同。

共享真实文件场景来自 `scenarios.ts`，另有 `fileWatcher.lifecycle.test.ts` 使用 Parcel subscription mock 验证适配器的异步所有权。mock 用例没有打开原生订阅，不能提供真实原生行为证据。

| 既有场景 | 适配层已表达的公有行为 | 尚未覆盖的精确边界 |
| --- | --- | --- |
| `recover-recursive-win32` | `directory-delete-and-recreate`、`missing-root-and-file-recovery` 覆盖目录恢复及后续保存 | Windows 精确 `EPERM/watch` 注册故障注入与恢复 |
| `recover-root-win32` | 缺失根恢复及文件重建 | `auto` native 根注册错误的精确分类 |
| `recover-cwd-depth-ignore-initial-win32` | `depth-and-target-promotion`、`ignore-initial-and-dynamic-targets` | Chokidar `cwd` 相对输出及 Windows 故障与配置的组合 |
| `removed-exact-native-classification` | 生命周期 mock 验证通用原始 Error 身份 | 原生平台错误分类、原始 syscall/path 和 probe 证据 |
| `removed-exact-nonwindows-propagates` | 通用原始 Error 身份 | 非 Windows 分类负控 |
| `permission-existing-win32-propagates` | 通用原始 Error 身份 | 现存路径 `EPERM` 的负控 |
| `removed-wrong-syscall-win32-propagates` | 通用原始 Error 身份 | 错误 syscall 负控 |
| `removed-wrong-path-win32-propagates` | 通用原始 Error 身份 | 错误 path 负控 |
| `case-only-wrong-path-win32-propagates-original` | 通用原始 Error 身份 | 仅大小写不同的 path 负控 |
| `removed-eacces-win32-propagates` | 通用原始 Error 身份 | `EACCES` 负控 |
| `missing-probe-error-win32-propagates-original` | 通用原始 Error 身份 | presence probe 失败及错误身份 |
| `close-during-root-readdir` | `close-during-registration` 和 mock subscribe 门禁覆盖注册中关闭 | 暂停真实 root readdir 后关闭及原读取排空 |
| `close-during-child-stat` | 注册关闭、等待 subscribe/unsubscribe 完成 | 暂停真实 child stat 后关闭及旧读取排空 |
| `remove-parent-during-child-stat` | 目录删除重建的公有结果 | 父目录删除后释放旧 child stat 的负控 |
| `recreate-before-old-target-read-returns` | 目录恢复后再次保存 | 新目录先建立、旧 listing 后返回的确定性代际边界 |
| `shared-native-owner-survives-close` | `shared-target-independent-owners` 覆盖两 owner 收到同次保存、一个退出、幸存者保存、最终静默 | 物理资源只获取一次及精确原生关闭回执 |
| `shared-owner-survives-failed-sibling-registration` | mock 覆盖单 owner 多根注册部分失败后的清理 | 独立兄弟 owner 注册失败与幸存 owner 继续保存的组合 |
| `file-generation-before-remove-cooldown` | 文件删除、重建及后续保存 | 精确旧代边界受控期间再次删除，以及旧读取不能提交 |
| `directory-generation-before-remove-cooldown` | 目录及子文件删除、重建、后续保存 | 目录和子项再次删除与旧代读取交错 |
| `atomic-readd-coalesces-with-held-remove-cooldown` | `atomic-replacement-and-next-save` 覆盖真实 rename 和下一次保存 | 持有原 unlink flush、恰好一次 change 及通知因果；重复仅计数 |
| `old-file-listener-enoent-after-replacement` | 原子替换后下一次写入 | 旧文件 ENOENT 延迟返回且不能移除新代文件 |
| `native-inode-rebind-observes-next-change` | 原子替换后观察下一次保存 | stat/inode 代的精确关联及原生资源终结 |
| `shared-native-inode-direct-file` | 共享 owner 与原子替换分别有覆盖 | 两 owner 共享物理资源与 inode 替换的组合 |
| `polling-file-events-and-exact-stop` | 适配器对 Parcel polling 显式报错 | Parcel 不提供 polling；保留 Chokidar 专用 polling 行为和停止契约 |
| `polling-upgrade-old-owner-close` | 共享 owner 退出的公有行为 | polling interval/persistence 升级后关闭旧 owner |
| `polling-upgrade-new-owner-close` | 共享 owner 退出的公有行为 | polling interval/persistence 升级后关闭升级 owner |
| `synchronous-add-cancel-preserves-shared-owner` | 异步注册中 close 及关闭后 add/updateTargets 返回 closed | 同步 add/ready 回调内 close/unwatch 与幸存兄弟 owner |
| `shared-native-inode-late-sibling-enoent` | 共享 owner 与替换分别有覆盖 | 兄弟 owner 已看到新代后迟到 ENOENT 的负控 |
| `shared-native-inode-survivor-after-close` | 一个 owner 退出后幸存者能保存 | 共享 inode 替换、代际边界与最后原生关闭的组合 |

适配层还覆盖外部及链式符号链接的逻辑路径、链接重定向、深度重新定基、动态依赖首保存、稳定写入和 1024 文件树中的连续单文件保存。这些用于统一 weapp-vite 自有观察层的消费语义，不扩展为对 Vite/Rolldown 全部监听的替换保证。

每个期望文件事件另行核验最终内容摘要、目录类型或删除状态，但没有原生通知到具体文件版本的因果证据。迟到旧通知仍可能解释下一步同路径事件；最新版本是否被消费必须由真实 HMR 产物验证。Node 句柄和 RSS 采样也不能替代既有依赖契约的原生资源回执。

因此既有 29 项依赖契约仍需保留；平台模拟不能替代真实三系统执行，适配层本机结果也不能独立支持修改默认后端。
