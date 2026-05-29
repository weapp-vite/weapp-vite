---
name: native-to-weapp-vite-wevu-migration
description: 面向原生微信/支付宝/抖音小程序渐进迁移到 `weapp-vite + 原生` 或继续升级到 `weapp-vite + wevu + Vue SFC` 的结构化工作流，重点覆盖路线选择、工具链接入、原生保留、Vue SFC 试点、wevu 响应式升级、截图/日志/e2e 验证与 AI 维护约束。
---

# native-to-weapp-vite-wevu-migration

## 用途

把原生小程序渐进迁移到 `weapp-vite + 原生`，或在此基础上继续迁移到 `weapp-vite + wevu + Vue SFC`，遵循“先选路线、再接入工具链、行为等价优先、每步可回滚”。

## 路线定位

本 skill 不拆成两个独立 skill。原因是两条路线共享同一套原生资产盘点、工具链接入、验证闭环、AI 指引和回滚治理；很多团队会先停在 `weapp-vite + 原生`，再按页面族逐步进入 `weapp-vite + wevu`。拆开会让同一个迁移项目在中途切换上下文，容易漏掉已确认的风险资产和回滚点。

应用时先明确路线：

- 路线 A：`weapp-vite + 原生`。保留 `Page/Component + WXML/WXSS/JSON`，目标是现代构建、TS、路径、资源、DevTools、截图日志和 AI 协作能力。
- 路线 B：`weapp-vite + wevu + Vue SFC`。在路线 A 稳定后，按页面族或新页面逐步迁到 `.vue`、响应式状态和类型化组件契约。

## 何时使用

- 用户要把原生 `Page/Component` 迁到 `.vue`。
- 用户想先保留原生代码，只把构建、TS、路径、资源、调试、AI 维护能力切到 `weapp-vite`。
- 用户需要制定原生项目的分阶段迁移路线，而不是一次性重写。
- 用户要把 `setData` 重构为响应式状态。
- 用户要迁移 `properties/observers/triggerEvent`。
- 用户要引入 `definePageMeta` / layout / autoRoutes / 受管 TS。
- 用户要在迁移后让 AI 能稳定使用项目。

## 不适用场景

本 skill 聚焦迁移路径和风险治理。

- 普通 weapp-vite 配置问题：使用 `weapp-vite-best-practices`。
- `.vue` 宏或模板兼容：使用 `weapp-vite-vue-sfc-best-practices`。
- `wevu` 运行时写法优化：使用 `wevu-best-practices`。

## 核心流程

1. 先盘点原生项目：`app.json`、页面路由、自定义组件、分包、npm 构建、插件、wxs/sjs、云开发、宿主 API、CI 与 DevTools 打开方式。
2. 先选择目标路线：
   - 路线 A：只迁工具链，原生页面继续作为一等资产。
   - 路线 B：先完成路线 A，再做 SFC 试点和页面族迁移。
3. 选择渐进策略：
   - 工具链优先：先让原生页面经 `weapp-vite` 构建、dev、build、open、日志和截图跑通。
   - 原生收口：对齐 TS、路径别名、资源处理、环境变量、npm 构建、AI 指引和 CI 命令后停在路线 A。
   - 岛屿迁移：新页面或低风险页面先用 `.vue`，旧页面保持原生。
   - 页面族迁移：按业务域迁一组页面和依赖组件。
4. 固化迁移前基线：页面入口、关键交互、关键接口、已知异常、至少一条冒烟路径。
5. 建立双轨边界：明确哪些页面仍是原生资产，哪些页面进入 Vue SFC；每一波次只改变一个边界。
6. 先做工具链接入：
   - 补齐 `vite.config.ts` / `weapp` 配置。
   - 接入 `wv prepare` 与 `.weapp-vite` 支持文件。
   - 跑通 dev/build/open/screenshot/logs 的最小闭环。
7. 如果目标是路线 A，到这里先收口，不继续改业务页面：
   - 原生页面和组件继续由 `weapp-vite` 构建。
   - 新增原生页面的约定、命令和验证写入项目维护文档。
   - 记录未来进入路线 B 的触发条件。
8. 如果目标是路线 B，再做机械迁移，保持行为不变：
   - `js/wxml/wxss/json` -> `.vue`
   - `properties` -> `defineProps`
   - `triggerEvent` -> `defineEmits`
   - `observers` -> `watch/watchEffect`
9. 最后做运行时升级：
   - `this.data/setData` -> `ref/reactive/computed`
   - 页面元信息走 `definePageMeta`
   - 平台分支收敛到 `import.meta.env.PLATFORM`
10. 迁移后统一 AI/工具链约束：先读根 `AGENTS.md` 与 `node_modules/weapp-vite/dist/docs/*.md`，先跑 `wv prepare`，明确 `wv screenshot` / `wv compare` / `wv ide logs --open`。
11. 每波次独立验证并保留回滚点；布局或视觉变化再补截图对比。

## 渐进迁移波次模板

- 第 0 波：原生项目体检，明确路线 A / B、风险资产、关键链路和回滚点。
- 第 1 波：只接入 `weapp-vite` 工具链，不改业务页面；目标是原生项目仍能构建、打开、调试和产出小程序目录。
- 第 2 波：路线 A 收口，把类型、别名、环境变量、资源处理、CI 命令和 AI 指引纳入受管工具链。
- 第 3 波：路线 B 试点，选择新页面、低风险页面或内部工具页作为 `.vue` 试点，验证原生页面与 Vue 页面能共存。
- 第 4 波：迁移共享组件和页面族，收敛 props/events/slot/样式作用域契约。
- 第 5 波：语义升级 `setData`、全局状态、路由、layout、多平台分支和截图/e2e 回归。

## 决策规则

- 如果业务仍在快速迭代，优先采用“新功能 Vue 化、旧功能原生保留”。
- 如果原生页面依赖复杂插件、wxs/sjs、云开发或宿主特性，先保持原生，建立工具链和验证闭环后再迁。
- 如果页面已经稳定且测试路径明确，适合按页面族迁移。
- 如果只是想获得 Vite/TS/AI/调试收益，不要强制把所有页面立刻改成 Vue SFC。
- 如果团队选择路线 A，应把 `weapp-vite + 原生` 当作可交付终点，而不是未完成的路线 B。
- 如果未来可能进入路线 B，应在路线 A 收口时记录候选页面、阻塞资产和验证基线。
- 每个波次都必须能单独回滚，不能把构建接入、路由调整、组件重写和视觉改版塞进同一个提交。

## 约束

- 不要在同一波次同时做迁移和架构重写。
- 不要把“接入 weapp-vite”误判为“必须立即重写所有原生页面”。
- 不要在用户只要求路线 A 时引入 `wevu` 运行时或 `.vue` 页面。
- 不要把原生实例对象暴露到模板状态。
- 不要跳过 `prepare` 和 `.weapp-vite` 支持文件验证。
- 不要只看 dev 环境，不看构建产物和真实运行时。

## 输出

应用本 skill 时，输出必须包含：

- 迁移波次。
- 每波次任务清单。
- 选择路线：A（`weapp-vite + 原生`）或 B（`weapp-vite + wevu + Vue SFC`），以及判断理由。
- 原生保留区与 Vue 迁移区的边界；如果选择路线 A，说明暂不进入 Vue 迁移区。
- 风险点与回滚点。
- 最小验证命令。

## 完成标记

- 路线 A：原生页面/组件已纳入 `weapp-vite` 构建、调试、AI 和验收闭环，且明确记录是否暂不引入 `wevu`。
- 路线 B：页面/组件已完成 `.vue` 化或明确记录留在原生的原因。
- 路线 B：状态更新不依赖大对象 `setData`。
- 路线 B：props / events 契约类型化。
- `.weapp-vite` 支持文件和 AI 指引已对齐。
- 至少有一轮可复现验证覆盖关键链路。

## 参考资料

- `references/migration-checklist.md`
- `references/progressive-adoption-playbook.md`
- `references/route-a-native-only.md`
- `references/api-mapping-and-pitfalls.md`
