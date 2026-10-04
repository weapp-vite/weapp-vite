# 自定义 profile 输出的真实 Vite 失败恢复回归

同一份 `e2e/ci/hmr-profile-failed-recovery.test.ts` 在未修复产物上失败，在修复产物上通过。测试从公开 `weapp-vite/vite` 入口启动真实 Vite 宿主，由文件系统监听接收变化，没有手动调用 `hotUpdate`。

固定场景是首次页面语法错误、一次仍然错误的源码修改、失败记录写入后的五秒静置、修正源码、正常后续修改，以及成功后的五秒静置。测试复用 `issue-1134-profile` fixture 的独立临时副本，真实 AppID 和原有条件页保持一致，检查页面 JS、JSON、WXML 均已发布。

| 观察项 | 未修复产物 | 修复产物 |
| --- | --- | --- |
| 实际 Vite watch root | fixture 根目录 | fixture 根目录 |
| 自定义 profile 路径 | `reports/hmr-profile.jsonl` | 相同 |
| 用户失败修改后静置记录数 | 3 → 5 | 2 → 2 |
| 恢复及正常修改后静置记录数 | 7 → 8 | 3 → 3 |
| profile 文件出现在源事件中的次数 | 8 | 0 |
| 修复源码及后续正常修改 | 产物均恢复 | 产物均恢复 |
| 用例结果 | 预期失败 | 通过 |

负向对照记录了 profile 文件自身的 `create/update` 事件进入失败构建链。正向记录只有初始失败、本次源码失败及正常 HMR 成功三条。启动时可能还有生成 TypeScript 支持文件的合法事件，因此测试必须等到本次页面源码对应的 `failed` 记录后建立静置基线；两个静置阶段都比较完整记录，且最终要求 profile 文件源事件为零。

未修复对照使用 `8cd8b9ccf897ce7d40ada65681356093416d6fbd` 的 114 个已构建 dist 文件，provider 与 service 源文件和之前单位回归的负向版本逐字节一致。正向使用 `bed518b2b57d5853a1ab8c0e73c52dd9ab424aa3` 工作树中的修复源码构建，记录了 118 个 dist 文件身份；该 commit ID 只是工作树基线，并不代表未提交修复已经包含在该 commit 中。两侧运行后均无源码或产物哈希漂移。完整身份摘要及私有日志校验和保存在相邻 JSON 报告中。

每轮均验证宿主完成关闭、所持有子进程已退出、临时 fixture 已删除，重复 `stop` 仍安全。结束后再次检查没有本任务遗留宿主或临时 fixture；没有操作用户的 IDE 或浏览器。

默认 `.weapp-vite/hmr-profile.jsonl` 路径的早期旧产物对照通过，未复现反馈。这里的根因结论限定于已观察到的自定义路径，不据此声称默认路径必然发生额外构建，也不更改历史 HMR 性能判断。此测试是编译宿主与文件系统的集成回归，没有运行真实 WeChat DevTools，不能替代 issue 的最终小程序 runtime 验收。

最小复验命令：

```sh
pnpm --filter weapp-vite build
pnpm vitest run -c e2e/vitest.e2e.ci.config.ts e2e/ci/hmr-profile-failed-recovery.test.ts --maxWorkers 1
```

负向产物对照可通过 `WEAPP_VITE_E2E_PROFILE_PACKAGE_ROOT` 选择预先构建的 `weapp-vite` 包目录；默认始终使用当前仓库产物。仓库 E2E 必须全局串行，启动前先核对活动进程。
