# Skills Trigger Regression Checklist

## 目标

验证以下 5 个 skills 在隐式触发（不显式写 `$skill-name`）时是否命中正确：

- `weapp-vite-best-practices`
- `weapp-ide-cli-best-practices`
- `weapp-vite-vue-sfc-best-practices`
- `wevu-best-practices`
- `native-to-weapp-vite-wevu-migration`

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

1. 提问：帮我重构 `vite.config.ts` 的 `weapp` 配置，顺便把分包和 chunk 策略梳理一下。
   预期 skill：`weapp-vite-best-practices`

2. 提问：`app.json` 和自动路由怎么配合，才能保证 pages/subPackages 输出稳定？
   预期 skill：`weapp-vite-best-practices`

3. 提问：我们 CI 想拆成编译和 devtools preview 两步，`weapp-ide-cli` 怎么接入更稳？
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

3. 提问：一个组件里能同时写 `defineComponentJson` 和 `definePageJson` 吗？
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

1. 提问：请把 `weapp-ide-cli` 的命令整理成统一目录导出，让上游 CLI 可以判断是否透传。
   预期 skill：`weapp-ide-cli-best-practices`

2. 提问：`weapp-vite` 和 `weapp-ide-cli` 的命令分发优先级该怎么设计，避免冲突？
   预期 skill：`weapp-ide-cli-best-practices`

3. 提问：`weapp-ide-cli` 的报错文案默认中文，但要支持切换英文，配置应该怎么落地？
   预期 skill：`weapp-ide-cli-best-practices`

4. 提问：我需要给 `weapp-ide-cli` 新增 `config import/export/doctor` 的规范和测试策略。
   预期 skill：`weapp-ide-cli-best-practices`

5. 边界提问：我们现在只想优化 `vite.config.ts` 的分包和 chunk，不改 CLI。
   预期 skill：`weapp-vite-best-practices`

## 冲突场景回归

1. 提问：我这个页面 `v-model` 报错，同时首包也超了，先看哪个？
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
