# #1086：按顺序合并后的 main 同步验证

PR #1083 已 squash 合入 `1784c0f2dbf568bb1a7d14961f23a7f0afbdffdf`；#1085 最终 HEAD `b106c6a954a1e35e69e83e7f1388526cebb9c20d` 普通 CI 31 success / 10 skipped 后，squash 合入 `6f58e5394a921116a5d09a8150922fc066506ec8`。两项原始材料均保全后移除已合并工作树。Nightly 结果原样保留，按维护者确认口径非阻断，#1082 保持开放。

本次将该 main 普通 merge 到 #1086 的 `36ca65627dbcb28976c5a721b27cb394b832caa8`，无强推。报告索引保留双方链接；suite manifest 与覆盖测试保留 main 的 #1089 和本 PR 的六个 stateful 场景。生成清单通过 `pnpm e2e:dom-acceptance:write` / `check` 重建，不手工拼接：112 tasks / 298 cases / 0 missing。

## 验证

- 先重建 constants、compiler、wevu、web、simulator 与 weapp-vite；dist 对应合并后源码。
- 路径作用域、symlink/模块图、分块/配置服务、路由 resolver 生命周期、suite/manifest 共 8 文件 140 tests 通过。weapp-vite typecheck、test:types 与 scoped ESLint 通过。
- 直接执行 `getSuiteTasks('ide-dom-headless')` 中的 stateful 任务，六个场景全部通过，37/37 DOM，进程 exit 0。覆盖资产新增/删除/恢复、editor 文件、模板派生计算与事件、native/component/wevu 两轮模板往返。
- 首次手工命令遗漏 provider 环境变量，实际启动 DevTools，随后中断 exit130。该运行留下测试插入的两个节点，造成下一次 headless 的初始 derived-count 断言失败（5/6 cases、31/37 DOM）。保留完整失败；保存残留文件并核对其与仓库原件差异后恢复干净 fixture，再执行上述同一个 manifest 任务。未修改断言、轮询或产品以求通过。最终 fixture 无未提交差异。

## 仍然阻断本 PR 的事项

本机 Computer Use 报告锁屏且无法自动解锁，本轮新增 TDesign Page/事件/页面栈数据对照未执行。其正常开发服务已终结，不计为真实运行时通过。完整默认 layout 的 TDesign 自动启动/数据一致性，以及 Wevu 首次模板更新与完整状态保持仍待定位；没有将未归因问题写成宿主限制。PR 保持草稿，未合并。

此次为合入已验证的 main 与诊断记录；没有额外产品行为改动，不新增 changeset，双方已有中文 changeset 均保留。最终 HEAD 普通 CI 仍须重新完成；#1092 不在本次范围，Codex 定时任务保持关闭。

[完整脱敏日志与 DOM](./issue1082-ordered-main-sync.json.gz)：解压 495133 bytes，SHA256 `6408c2155116a6b936e56032ce569a7a4cf06f664ee32e503b3b4c9831149d4c`。归档保留各原件 raw SHA、被测双方提交、暂存 tree 与文件 hash；原始材料保存在本地。
