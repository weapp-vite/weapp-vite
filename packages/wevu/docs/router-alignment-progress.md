# wevu/router 对齐进展与风险清单

本文档汇总最近一轮 `wevu/router` 对齐 Vue Router 心智的落地结果，帮助评估当前可发布边界与后续优先级。

## 1. 已完成能力（本轮）

### 1.1 `routes` 心智对齐与兼容策略

- `useRouter()` 新增 `routes` 入口，作为推荐写法。
- `namedRoutes` 保持兼容入口，支持对象 map 与数组写法。
- 同名覆盖规则明确：`routes` 与 `namedRoutes` 同时存在时，后者覆盖前者。
- 覆盖时输出告警，且包含来源与路径变化，便于迁移排查。

### 1.2 动态替换行为收敛

- `addRoute()` 同名替换时，会先移除旧记录及其 `children` 链，再写入新记录。
- 静态路径匹配索引会随替换刷新，避免旧路径残留命中。
- `alias`、`beforeEnter`、`redirect` 在替换后均以新记录为准。
- 替换告警包含 `旧路径 -> 新路径` 与清理子路由数量。

### 1.3 `options` 语义明确化

- `router.options` 现在是运行时冻结的初始化快照（非响应式）。
- 不会随 `addRoute/removeRoute/clearRoutes` 动态变化。
- 动态路由状态统一通过 `router.getRoutes()` 读取。

### 1.4 初始化配置校验收紧

- 初始化阶段对于无效路由记录采用“告警并跳过”策略，保证容错：
  - 空 `name/path`
  - 重复 `alias`、`alias` 与主路径相同
  - 循环 `children` 引用
- `addRoute()` 根记录采用“失败即抛错”策略，避免运行时写入不完整路由：
  - 缺失 `name/path`
  - 循环 `children` 引用

## 2. 当前风险与边界

### 2.1 已知平台边界（非实现缺陷）

- 小程序不支持前进栈，`forward()` / `go(>0)` 仍返回 `aborted`。
- 不支持 Vue Web 的嵌套视图渲染语义（仅提供路由匹配链与守卫链）。

### 2.2 仍可继续打磨项

- 冲突告警分级：目前统一 `warn`，可进一步区分“低风险冗余”与“高风险覆盖”。
- `addRoute(parentName, route)` 的父子冲突文案可以更细（例如 parent 路径上下文）。
- 配置校验规则可抽成独立章节文档，便于团队约定与审查。

## 3. 建议发布前检查清单

1. 对所有业务入口统一检查 `routes`/`namedRoutes` 是否混用且出现冲突告警。
2. 抽查核心页面的动态替换链路（含 alias、beforeEnter、redirect）。
3. 迁移期确保业务代码不直接修改 `router.options`，改用 `getRoutes()` 观察动态状态。
4. 对关键路径开启 `paramsMode: 'strict'`，提前暴露历史参数拼接问题。

## 4. 建议下一步优先级

1. 增加一条 `e2e-apps/github-issues` 场景，覆盖“同名替换 + alias + redirect”端到端行为。
2. 细化告警分级与稳定错误码，便于日志聚合与告警治理。
3. 评估 `currentRoute` 对齐策略（是否提供 Ref 风格兼容层）以降低迁移改造量。
