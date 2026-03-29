# Skills Trigger Regression Checklist

## 目标

验证以下 10 个 skills 在隐式触发（不显式写 `$skill-name`）时是否命中正确：

- `weapp-vite-best-practices`
- `docs-and-website-sync`
- `github-issue-fix-workflow`
- `release-and-changeset-best-practices`
- `weapp-devtools-e2e-best-practices`
- `weapp-ide-cli-best-practices`
- `weapp-vite-vue-sfc-best-practices`
- `wevu-best-practices`
- `native-to-weapp-vite-wevu-migration`
- `weapp-vite-wevu-performance-best-practices`

## 执行方式

1. 每条用例尽量在新会话执行，避免上下文污染。
2. 不要在提问里包含 skill 名称，保持“真实用户提问”。
3. 记录实际命中的 skill，与“预期 skill”对比。
4. 若命中错误，记录误命中的 skill 与触发语句。

## 半自动打分

填完“记录模板”后，可运行：

```bash
node skills/scripts/score-skill-trigger-regression.mjs
```

或使用根脚本：

```bash
pnpm skills:score
```

指定文件路径：

```bash
node skills/scripts/score-skill-trigger-regression.mjs --file skills/skill-trigger-regression-checklist.md
```

输出 JSON（便于 CI 或二次处理）：

```bash
node skills/scripts/score-skill-trigger-regression.mjs --json
```

```bash
pnpm skills:score:json
```

## 用例清单

### A. weapp-vite-best-practices

1. 提问：我在别的仓库里装了 `weapp-vite`，AI 应该先看 `node_modules/weapp-vite/dist/docs` 还是网站文档？顺便把 `vite.config.ts` 的 `weapp` 配置和分包策略梳理一下。
   预期 skill：`weapp-vite-best-practices`

2. 提问：`app.json` 和自动路由怎么配合，才能保证 pages/subPackages 输出稳定？
   预期 skill：`weapp-vite-best-practices`

3. 提问：我们 CI 想拆成编译和 devtools preview 两步，而且希望 AI 默认会用 `wv` / `weapp-vite` 的命令，`weapp-ide-cli` 该怎么接入更稳？
   预期 skill：`weapp-vite-best-practices`

4. 提问：构建后 `typed-router.d.ts` 没更新，怎么排查是路由生成还是配置问题？
   预期 skill：`weapp-vite-best-practices`

5. 边界提问：`definePageJson` 和 `<json>` 优先级怎么判定？
   预期 skill：`weapp-vite-vue-sfc-best-practices`

### B. weapp-vite-vue-sfc-best-practices

1. 提问：小程序里 `v-model` 为什么只能写可赋值表达式？`x + y` 为什么不行？
   预期 skill：`weapp-vite-vue-sfc-best-practices`

2. 提问：页面 SFC 用 `definePageJson` 后，`<json>` 里 `usingComponents` 还会生效吗？
   预期 skill：`weapp-vite-vue-sfc-best-practices`

3. 提问：页面 SFC 里能同时写 `definePageJson` 和 `definePageMeta` 吗？各自负责什么？
   预期 skill：`weapp-vite-vue-sfc-best-practices`

4. 提问：`v-bind="obj"` 在 weapp-vite 模板里行为不对，该怎么改写更稳？
   预期 skill：`weapp-vite-vue-sfc-best-practices`

5. 边界提问：我们要做分包首开性能优化，是选 `duplicate` 还是 `hoist`？
   预期 skill：`weapp-vite-best-practices`

### C. wevu-best-practices

1. 提问：`setup()` 里 `await` 后再注册生命周期为什么不触发？
   预期 skill：`wevu-best-practices`

2. 提问：Pinia 在 wevu 里解构状态后丢响应性，`storeToRefs` 应该怎么用？
   预期 skill：`wevu-best-practices`

3. 提问：组件事件里 `emit(event, detail, options)` 的 `detail` 结构怎么设计更兼容小程序？
   预期 skill：`wevu-best-practices`

4. 提问：表单组件二次封装时，用 `bindModel` / `useBindModel` 的推荐模式是什么？
   预期 skill：`wevu-best-practices`

5. 边界提问：`definePageJson` 和 `defineComponentJson` 该怎么选？
   预期 skill：`weapp-vite-vue-sfc-best-practices`

### D. native-to-weapp-vite-wevu-migration

1. 提问：我们想把原生 `Page/Component` 迁到 Vue SFC，怎么分批做且可回滚？
   预期 skill：`native-to-weapp-vite-wevu-migration`

2. 提问：原来大量 `setData` 的页面迁移到 `ref/reactive`，有没有分阶段改造策略？
   预期 skill：`native-to-weapp-vite-wevu-migration`

3. 提问：`properties/observers/triggerEvent` 到 `defineProps/watch/defineEmits` 的映射怎么落地？
   预期 skill：`native-to-weapp-vite-wevu-migration`

4. 提问：迁移期间如何设计 e2e，既抓运行时报错又保留回滚点？
   预期 skill：`native-to-weapp-vite-wevu-migration`

5. 边界提问：我们现在不是迁移，只是优化现有 weapp-vite 的分包配置。
   预期 skill：`weapp-vite-best-practices`

### E. weapp-ide-cli-best-practices

1. 提问：请把 `weapp-ide-cli` 的命令整理成统一目录导出，让上游 CLI 可以判断是否透传，尤其是 `screenshot` 这种 AI 会直接用到的命令。
   预期 skill：`weapp-ide-cli-best-practices`

2. 提问：`weapp-vite` / `wv` 和 `weapp-ide-cli` 的命令分发优先级该怎么设计，避免 `screenshot`、`open` 这些命令冲突？
   预期 skill：`weapp-ide-cli-best-practices`

3. 提问：`weapp-ide-cli` 的报错文案默认中文，但要支持切换英文，配置应该怎么落地？
   预期 skill：`weapp-ide-cli-best-practices`

4. 提问：我需要给 `weapp-ide-cli` 新增 `config import/export/doctor` 的规范和测试策略。
   预期 skill：`weapp-ide-cli-best-practices`

5. 边界提问：我们现在只想优化 `vite.config.ts` 的分包和 chunk，不改 CLI。
   预期 skill：`weapp-vite-best-practices`

### F. weapp-vite-wevu-performance-best-practices

1. 提问：页面滚动明显掉帧，怀疑是 `onPageScroll` 里频繁 `setData`，该怎么系统排查？
   预期 skill：`weapp-vite-wevu-performance-best-practices`

2. 提问：首屏还行，但页面切换经常慢半拍甚至白屏，我想按导航链路做性能治理。
   预期 skill：`weapp-vite-wevu-performance-best-practices`

3. 提问：商品图片列表在 iPhone 上容易触发内存告警，`wevu` 这边该怎么收敛资源和缓存？
   预期 skill：`weapp-vite-wevu-performance-best-practices`

4. 提问：想给 `weapp-vite + wevu` 项目建一套性能基线、回归信号和回滚开关，应该怎么设计？
   预期 skill：`weapp-vite-wevu-performance-best-practices`

5. 边界提问：我们主要是想调 `subpackage` 和 `sharedStrategy`，提升首开速度，先看哪个 skill？
   预期 skill：`weapp-vite-best-practices`

### G. docs-and-website-sync

1. 提问：根据现在仓库里的代码和脚本，把 `website` 的 AI 页面、Skills 文档和 `wv` 简写命令说明同步一下。
   预期 skill：`docs-and-website-sync`

2. 提问：我们刚给 CLI 加了 `screenshot`、`dist/docs` 和模板 `AGENTS.md` 这些 AI 入口，帮我把站点、README 和相关 Skills 入口一起更新。
   预期 skill：`docs-and-website-sync`

3. 提问：现在文档入口有点过期，请按真实实现刷新 `guide/ai`、组件页和生成产物。
   预期 skill：`docs-and-website-sync`

4. 提问：新增了一个 skill，顺便也补上安装方式，比如 `npx skills add sonofmagic/skills`，再把文档入口、回归清单和评分脚本一起补齐。
   预期 skill：`docs-and-website-sync`

5. 边界提问：我不是要同步文档，我是要改 `vite.config.ts` 的分包策略。
   预期 skill：`weapp-vite-best-practices`

### H. github-issue-fix-workflow

1. 提问：这个 GitHub issue 我想按仓库流程修，先在仓库里的可写目录建 worktree，并补一个最小复现。
   预期 skill：`github-issue-fix-workflow`

2. 提问：请把这个 bug 先放进 `e2e-apps/github-issues` 复现，再分析根因和修复。
   预期 skill：`github-issue-fix-workflow`

3. 提问：我需要一个从 issue 复现、补单测、补 e2e 到开 PR 的完整闭环。
   预期 skill：`github-issue-fix-workflow`

4. 提问：这个线上 bug 已经有 issue 了，帮我按 worktree + changeset + 中文 PR + CI 跟进的标准流程处理。
   预期 skill：`github-issue-fix-workflow`

5. 边界提问：我只是要更新 AI 文档入口，不是修 issue。
   预期 skill：`docs-and-website-sync`

### I. weapp-devtools-e2e-best-practices

1. 提问：帮我给 `e2e/ide` 新增一个 runtime 用例，要求同一个 app 只启动一次 automator，后面还能稳定给 AI 做 screenshot 验收。
   预期 skill：`weapp-devtools-e2e-best-practices`

2. 提问：这个 IDE e2e 里多个页面场景应该怎么通过 `miniProgram.reLaunch(...)` 串起来？
   预期 skill：`weapp-devtools-e2e-best-practices`

3. 提问：我给 `e2e-app` 新增了页面，`project.private.config.json` 和真实 AppID 这块要怎么同步？
   预期 skill：`weapp-devtools-e2e-best-practices`

4. 提问：为什么仓库里不建议在每个 `it` 里都 `launchAutomator()`？这个 suite 该怎么重构？
   预期 skill：`weapp-devtools-e2e-best-practices`

5. 边界提问：我现在不是写 IDE e2e，而是设计 `weapp-ide-cli` 的 automator 命令。
   预期 skill：`weapp-ide-cli-best-practices`

### J. release-and-changeset-best-practices

1. 提问：这个改动要不要加 changeset？如果要，顺便看看 commit 类型该怎么写。
   预期 skill：`release-and-changeset-best-practices`

2. 提问：我改了 `weapp-vite`、模板生成的 `AGENTS.md` 和随包 `dist/docs`，帮我判断是不是还要补 `create-weapp-vite` 的 changeset。
   预期 skill：`release-and-changeset-best-practices`

3. 提问：请按仓库规则检查这次发布前还缺哪些 changeset 和 release 校验。
   预期 skill：`release-and-changeset-best-practices`

4. 提问：这个 bugfix 要走 commit-only 还是 PR？changeset summary 应该怎么写才符合规范？
   预期 skill：`release-and-changeset-best-practices`

5. 边界提问：我现在不是准备发版，而是要补 GitHub issue 的复现和 PR 闭环。
   预期 skill：`github-issue-fix-workflow`

## 冲突场景回归

1. 提问：我这个页面 `v-model` 报错，同时首包也超了，而且 AI 还需要按当前模板约定继续改这个页面，先看哪个？
   预期主 skill：`weapp-vite-vue-sfc-best-practices`
   预期次 skill：`weapp-vite-best-practices`

2. 提问：迁移原生页面后，`setup` 生命周期时序不对。
   预期主 skill：`native-to-weapp-vite-wevu-migration`
   预期次 skill：`wevu-best-practices`

3. 提问：`usingComponents` 不生效，怀疑是 weapp 配置和宏优先级都有关。
   预期主 skill：`weapp-vite-vue-sfc-best-practices`
   预期次 skill：`weapp-vite-best-practices`

4. 提问：我在 `weapp-vite` 里执行 `preview/upload`，想知道该走原生命令还是 `weapp-ide-cli` 透传。
   预期主 skill：`weapp-ide-cli-best-practices`
   预期次 skill：`weapp-vite-best-practices`

5. 提问：页面切换慢，同时 `onUnload` 里还有一堆运行时状态清理，先按性能还是运行时语义来拆？
   预期主 skill：`weapp-vite-wevu-performance-best-practices`
   预期次 skill：`wevu-best-practices`

6. 提问：CLI 能力刚变了，我既要更新站点说明，也要梳理命令归属和透传规则，先看哪个？
   预期主 skill：`docs-and-website-sync`
   预期次 skill：`weapp-ide-cli-best-practices`

7. 提问：一个 GitHub issue 里的复现同时涉及运行时生命周期异常，先按 issue workflow 还是 wevu 语义来拆？
   预期主 skill：`github-issue-fix-workflow`
   预期次 skill：`wevu-best-practices`

8. 提问：我要新增 DevTools runtime e2e，同时 CLI 的 automator 子命令也要对齐，先看哪个？
   预期主 skill：`weapp-devtools-e2e-best-practices`
   预期次 skill：`weapp-ide-cli-best-practices`

9. 提问：这个 issue 修复快做完了，我还想一起判断 changeset、commit 和 PR 交付方式，先看哪个？
   预期主 skill：`github-issue-fix-workflow`
   预期次 skill：`release-and-changeset-best-practices`

## 通过标准

1. 每个 skill 的 4 条主用例至少命中 3 条（>=75%）。
2. 边界用例不能持续误命中同一个错误 skill（最多 1 次）。
3. 冲突场景下，主 skill 判断与问题主轴一致。
4. 回答中包含结构化输出（诊断、改动、验证）视为加分项。

## 记录模板

| 编号 | 提问 | 预期 skill | 实际 skill | 结果(P/F) | 备注 |
| ---- | ---- | ---------- | ---------- | --------- | ---- |
| A1   |      |            |            |           |      |
| A2   |      |            |            |           |      |
| A3   |      |            |            |           |      |
| A4   |      |            |            |           |      |
| A5   |      |            |            |           |      |
| B1   |      |            |            |           |      |
| B2   |      |            |            |           |      |
| B3   |      |            |            |           |      |
| B4   |      |            |            |           |      |
| B5   |      |            |            |           |      |
| C1   |      |            |            |           |      |
| C2   |      |            |            |           |      |
| C3   |      |            |            |           |      |
| C4   |      |            |            |           |      |
| C5   |      |            |            |           |      |
| D1   |      |            |            |           |      |
| D2   |      |            |            |           |      |
| D3   |      |            |            |           |      |
| D4   |      |            |            |           |      |
| D5   |      |            |            |           |      |
| E1   |      |            |            |           |      |
| E2   |      |            |            |           |      |
| E3   |      |            |            |           |      |
| E4   |      |            |            |           |      |
| E5   |      |            |            |           |      |
| X1   |      |            |            |           |      |
| X2   |      |            |            |           |      |
| X3   |      |            |            |           |      |
| X4   |      |            |            |           |      |
| F1   |      |            |            |           |      |
| F2   |      |            |            |           |      |
| F3   |      |            |            |           |      |
| F4   |      |            |            |           |      |
| F5   |      |            |            |           |      |
| X5   |      |            |            |           |      |
| G1   |      |            |            |           |      |
| G2   |      |            |            |           |      |
| G3   |      |            |            |           |      |
| G4   |      |            |            |           |      |
| G5   |      |            |            |           |      |
| X6   |      |            |            |           |      |
| H1   |      |            |            |           |      |
| H2   |      |            |            |           |      |
| H3   |      |            |            |           |      |
| H4   |      |            |            |           |      |
| H5   |      |            |            |           |      |
| X7   |      |            |            |           |      |
| I1   |      |            |            |           |      |
| I2   |      |            |            |           |      |
| I3   |      |            |            |           |      |
| I4   |      |            |            |           |      |
| I5   |      |            |            |           |      |
| X8   |      |            |            |           |      |
| J1   |      |            |            |           |      |
| J2   |      |            |            |           |      |
| J3   |      |            |            |           |      |
| J4   |      |            |            |           |      |
| J5   |      |            |            |           |      |
| X9   |      |            |            |           |      |
