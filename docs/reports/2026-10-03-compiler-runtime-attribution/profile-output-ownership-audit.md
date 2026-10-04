# HMR profile 输出事件所有权回归

已用窄单测复现并修复失败恢复分支中的真实自反馈：借用 Vite 宿主时首构建失败，用户下一次修改仍然构建失败，写出的 failed profile 又作为输入进入恢复调度，造成第三次构建与新一条 failed profile。原断言要求两次构建，实际为三次。它不同于 HMR v2 run02 正常态中观察到的无关联 profile 回调，不能据此把那 5 次扰动改判为实际额外构建。

## 根因与边界

`moduleGraph/devProvider.ts` 的 `hotUpdate` 原先会读取 profile 再调用 `onChange`。正常态下，`runtime/buildPlugin/service.ts` 以“没有关联 module 且首构建未失败”提前返回；首次构建失败后为了允许源码恢复，该过滤会放行未登记的输入。profile 是编译器自己生成的文件，因此失败记录能够再次触发恢复构建。

修复将文件所有权放到共享 provider 边界：Vite watcher 的 ignored 配置精确排除当前启用的输出文件；`hotUpdate` 在 read 之前使用同一 matcher，阻断已在途或直接送入的输出事件。writer 和 matcher 共用 `resolveActiveHmrProfileJsonPath`，保留默认路径、配置路径、环境变量覆盖的原有语义。

匹配只针对完整文件路径，不忽略整个目录、相邻名称或源码根。关闭 profile 后同名用户文件继续处理；切换配置或环境变量时不保留旧文件的排除。路径使用仓库现有分隔符归一化，Windows 采用不区分大小写的匹配，其他平台保留大小写；未扩大为所有平台统一转小写。

## 红绿证据

- 修复前：2 项正常态检查通过，失败恢复回归失败，构建次数为 3 而非 2。正常态中，即使 profile 的 read Promise 尚未完成，另一条源码事件也能独立进入批次；没有证明正常态的 profile 回调会阻塞源码事件或触发额外构建。
- 修复后：13 项聚焦检查通过，包括默认/config/env 恢复分支、停用后同名用户文件、相邻路径、分隔符/大小写语义、用户 ignored 规则合并，以及 profile 不污染源码批次。
- 完整 4 文件回归：134 项通过、0 跳过、0 失败。`weapp-vite` 包内 TypeScript 检查、8 个改动 TS 文件 ESLint、changeset ESLint 和 `git diff --check` 均通过。
- 新增中文 patch changeset 同时覆盖 `weapp-vite` 与 `create-weapp-vite`，并用仓库 changeset 解析器核对联动。推荐提交类型为 `fix(weapp-vite)`。

可复现检查入口：

```sh
pnpm --filter weapp-vite exec vitest run --config vitest.config.ts src/runtime/buildPlugin/service.test.ts src/moduleGraph/profileOutput.test.ts src/moduleGraph/devProvider.test.ts src/utils/hmrProfile.test.ts --maxWorkers 1
pnpm --filter weapp-vite typecheck
```

实际调用使用现有 Node 24.18.0 与对应 CLI，避免在隔离 worktree 意外安装依赖。缺失的 AST 构建产物已在本 worktree 重建；其他缺失依赖仅在源码、package manifest 和构建配置逐字节相同后复用既有 bundler 产物。这份隔离单测审计没有运行 dev/watch、E2E 或性能重采样。主任务后续已重建 `weapp-vite`，完成真实 Vite 文件系统失败恢复红绿回归，见 [下游回归](profile-output-recovery-e2e.md)；整合后的路由范围也完成双 provider 验收，见 [路由报告](auto-routes-topology-acceptance.md)。这些结果不替代尚未通过的样式与正式性能门禁。

`devProvider.ts` 原本已超过 300 行，新增匹配逻辑拆入 26 行的 `profileOutput.ts`；原 service 只替换共享解析入口，未借此重构其调度器。测试继续复用现有控制器 mock，以实际 provider 的 hotUpdate 连接真实调度回调，不引入第二套控制器模型。正式性能 baseline、candidate、计时边界、阈值、HMR v2 原始证据与 issue 标签均未修改。
