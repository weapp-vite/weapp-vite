# 本地 Git 门禁

`pnpm install` 通过 `prepare: "repo tooling hooks install"` 调用 repoctl 原生安装器。`allowBuilds.lefthook: false` 防止依赖 postinstall 抢先安装。安装器迁移仓库拥有的旧 Husky 配置，并保留用户自定义或全局 `core.hooksPath`；需要时在现有 hook 中接入 `pnpm exec lefthook run <hook>`。CI 使用 `LEFTHOOK=0`。

`lefthook.yml` 声明串行的暂存快照、DOM/skills 契约、ESLint、Stylelint、微信配置 EOF 和类型检查。文件列表沿用 repoctl 模板的 Git NUL 输出与 `xargs -0`，不拼接文件名到 shell；过滤规则同时保留应用排除、小程序样式扩展和 changeset 专用格式检查。Lefthook 原生隐藏和恢复未暂存内容，并通过 `stage_fixed` 更新修复；后续失败可能保留前面已成功的修复，提交重试前应审阅索引。

根 `typecheck` 检查 `tsconfig.tooling.json` 声明的 repoctl 配置。最后的 `repo verify staged-typecheck` 原生按暂存文件所属 package 执行类型检查，同时改动根文件不会吞掉 package 检查。其余源码验证由 package 自身和 pre-push 的 affected 验证承担，不遍历应用或模板生成的 tsconfig。

`stage_fixed` 在整个 `pre-commit` 完成后才写入索引，因此最终索引语义检查放在 `commit-msg` 的首个串行步骤。该门禁读取索引，不受已恢复的未暂存内容影响。随后使用 Git 传入的消息文件路径（普通提交或合并），再调用 repoctl 的 commitlint 校验。`pre-push` 运行仓库的 quick/affected 验证，以 `origin/main` 为比较基线；不使用全仓 E2E 代替局部提交门禁。

Lefthook 原生 Git hook 在启动 jobs 前加载 `rc.sh`，由原始 `$1` 导出消息文件路径。固定的 Node adapter 读取该值并传给 repoctl 正式 API，避免 Windows `sh -c` 的二次命令行解析截断带空格的路径；单引号和中文同样原样保留。手动验证消息文件使用 `git hook run commit-msg -- <file>`，以经过同一原生入口。缺少消息参数时直接失败，不猜测 `.git/COMMIT_EDITMSG` 或替换合并消息文件。
