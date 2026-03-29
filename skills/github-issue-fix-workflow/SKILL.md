---
name: github-issue-fix-workflow
description: 面向采用 weapp-vite monorepo 布局仓库的 GitHub issue 修复工作流。适用于修复已报告的 GitHub issue、在 `e2e-apps/github-issues` 中复现 bug、从隔离 worktree 准备 PR，或执行完整的“复现 -> 根因分析 -> 修 packages/weapp-vite|wevu|templates|website|skills -> unit/e2e 覆盖 -> changeset -> PR”闭环。触发语句包括“修 GitHub issue”“复现这个 issue”“给这个 bug 补 github-issues case”“开 PR 修复”“按仓库流程修这个问题”等。
---

# github-issue-fix-workflow

## Purpose

把 GitHub issue 修复流程标准化，确保每次都按“独立 worktree、先复现、后定位、补 unit/e2e、再 PR”的顺序推进。

## 触发信号

- 用户要求修复某个 GitHub issue。
- 用户要求在 `e2e-apps/github-issues` 增加复现案例。
- 用户要求“开 PR 修这个 bug”或“按 issue 流程处理”。
- 用户给出 issue 链接/编号，希望完成从复现到验证的闭环。
- 用户要求对 bug 做最小复现、根因分析、回归用例补齐。

## 适用边界

本 skill 聚焦“GitHub issue 修复工作流”。

以下情况不应作为主 skill：

- 主要是在现有项目里做常规配置优化。使用 `weapp-vite-best-practices`。
- 主要是 `.vue` 宏和模板兼容。使用 `weapp-vite-vue-sfc-best-practices`。
- 主要是 `wevu` 生命周期、store 或事件语义。使用 `wevu-best-practices`。
- 主要是原生到 `weapp-vite + wevu` 的迁移规划。使用 `native-to-weapp-vite-wevu-migration`。
- 主要是网站、文档或 skill 入口同步。使用 `docs-and-website-sync`。

## 快速开始

1. 从主线或目标基线分支创建独立 `git worktree`。
2. 在 `e2e-apps/github-issues` 先建立最小复现。
3. 复现稳定后再做根因分析和源码修复。
4. 补 unit + e2e + changeset，完成定向验证后再开 PR。

## 执行流程

1. 先隔离工作区

- 在主线分支或约定基线上创建独立 `git worktree`。
- worktree 放在仓库可写目录内（例如 `.codex-tmp/<issue>`），不要放到仓库外。
- 不要在混杂其他未完成改动的工作区里直接做 issue 修复。
- worktree 命名与 issue 标识保持可追踪。

2. 先复现，后修复

- 先在 `e2e-apps/github-issues` 落地最小、可评审的复现案例。
- 确保问题可稳定复现后，再进入源码分析。
- 如果问题无法稳定复现，不要过早改源代码。

3. 做根因分析

- 先确认问题落在哪一层：
  - `weapp-vite` 构建/编译
  - `wevu` 运行时
  - `wevu-compiler` / SFC 转换
  - IDE / e2e / project config
- 分析结果要能解释复现现象，而不只是“修到不报错”。

4. 再做源码修复

- 只改与根因相关的包和文件。
- 若修改 `packages/*/src/**` 后要做 downstream 验证，先重建对应包产物。
- 不把“复现 app 调整”和“根因修复”混成无法审阅的大改动。
- 若修复会改变 AI 使用路径（如 screenshot、packaged docs、模板 `AGENTS.md`），同步补对应 docs/skills 入口。

5. 锁定回归

- 补或更新 unit tests，覆盖根因行为。
- 补或更新 e2e tests，验证端到端回归。
- 对 `e2e-apps/github-issues` 新增页面时：
  - 同步更新 `project.private.config.json` 的 `condition.miniprogram.list`
  - 保持 `project.config.json` 使用真实 AppID

6. 变更交付要求

- GitHub bug fix 必须补 changeset。
- 如果变更涉及 `weapp-vite`、`wevu` 或 `templates/*`，同时补 `create-weapp-vite` bump changeset。
- `.changeset/*.md` summary 段落使用中文。

7. 验证与收尾

- 先跑定向 unit + e2e 验证，再决定是否扩大范围。
- 验证通过后再开 PR 回目标主线分支。
- PR 标题、正文和后续 review comment 默认使用中文，除非用户明确要求其他语言。
- 继续跟进 CI/CD，确认检查通过后再视为可合并；合并后清理临时 worktree。

## 约束

- 不要跳过 `git worktree` 隔离步骤。
- 不要在复现不稳定时直接改源码碰运气。
- 不要只补 e2e 不补 unit，或只补 unit 不补 e2e。
- 不要漏掉 changeset，尤其是源码 bug fix。
- 不要在 issue 修复过程中顺手夹带无关重构。

## 输出要求

应用本 skill 时，输出必须包含：

- issue 复现路径与最小案例位置。
- 根因定位结论。
- 源码修复范围。
- unit/e2e/changeset/PR 的完成状态。
- worktree 位置与 PR/CI 状态。
- 定向验证命令与结果。

## 完成检查

- 已创建独立 worktree 并在其中完成 issue 工作。
- worktree 位于仓库可写目录内。
- `e2e-apps/github-issues` 已有最小复现或已确认无需新增并说明原因。
- 根因分析与最终修复一一对应。
- unit tests 与 e2e tests 已补齐。
- changeset 已添加且内容符合该仓库规则。
- PR 已创建或已明确记录下一步 PR 动作，且 CI 状态已确认。

## 参考资料

- `references/issue-fix-checklist.md`
