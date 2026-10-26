# 本地 Git 门禁

`pnpm install` 通过 `prepare` 安装 Lefthook。安装器仅删除仓库局部的 `.husky` / `.husky/_` 配置；用户已有的自定义或全局 `core.hooksPath` 会保留，需要在该 hook 中接入 `pnpm exec lefthook run <hook>`。CI 使用 `LEFTHOOK=0`。

`pre-commit` 串行检查暂存快照、DOM/skills 契约、ESLint、Stylelint、微信配置 EOF 和类型。文件列表来自 Git NUL 输出，通过 argv 传递，不拼接文件名到 shell。Lefthook 原生隐藏和恢复未暂存内容，并通过 `stage_fixed` 更新修复；后续失败可能保留前面已成功的修复，提交重试前应审阅索引。

根 `typecheck` 检查 `tsconfig.tooling.json` 声明的发布配置与 hook 工具边界。暂存文件按最近拥有 `typecheck` 脚本的 package 分组后调用 repoctl；同时改动根文件不会吞掉 package 检查。其余源码验证由 package 自身和 pre-push 的 affected 验证承担，不遍历应用或模板生成的 tsconfig。

`stage_fixed` 在整个 `pre-commit` 完成后才写入索引，因此最终索引语义检查放在 `commit-msg` 的首个串行步骤。该门禁读取索引，不受已恢复的未暂存内容影响。随后使用 Git 传入的消息文件路径（普通提交或合并），再调用 repoctl 的 commitlint 校验。`pre-push` 运行仓库的 quick/affected 验证，以 `origin/main` 为比较基线；不使用全仓 E2E 代替局部提交门禁。
