# API Mapping And Pitfalls

## 注册层

- 原生：`Page({...})` / `Component({...})`
- 迁移后：`<script setup>` + JSON 宏 + wevu hooks / API

重点：迁移后不再直接写原生构造器，生命周期通过 `wevu` hooks 注册。

渐进迁移时允许原生页面和 Vue SFC 页面共存。不要因为接入 `weapp-vite` 就立刻删除所有 `Page/Component` 文件；先用路由和构建验证证明两类页面能同时工作。

## 状态层

- 原生：`this.data` + `this.setData({ ... })`
- 迁移后：`ref/reactive` + 直接赋值

重点：

- 优先让 wevu diff 负责最小更新。
- 不要把原生实例对象混入可序列化状态。

## 组件契约层

- 原生：`properties` / `observers` / `triggerEvent`
- 迁移后：`defineProps` / `watch` / `defineEmits`

示例：

```ts
const emit = defineEmits<{
  change: [id: number]
  update: [value: string]
}>()
```

## 原生实例桥接

在 `setup(_, { instance })` 中访问原生能力：

- `instance.triggerEvent(...)`
- `instance.createSelectorQuery(...)`
- `instance.setData(...)`

迁移建议：

- 事件优先 `emit`
- 数据更新优先响应式状态
- `instance` 只做桥接，不做业务状态源

## 多平台分支

统一用 `import.meta.env.PLATFORM`，不要在业务代码散落 `wx/my/tt` 判断。

```ts
if (import.meta.env.PLATFORM === 'weapp') {
  wx.showToast({ title: 'ok' })
}
```

## 高频坑位

- 把“工具链接入”做成“一次性全量重写”，导致无法定位问题和回滚
- 试点页夹带全局状态、请求层或视觉系统重构，行为漂移无法归因
- 列表字段未兜底，导致 `map/forEach of undefined`
- `usingComponents` 未迁移到 JSON 宏，组件不渲染
- `query` 参数未 parse，导致类型错乱
- 只跑 dev 不跑 build
- e2e 未收集 runtime error，CI 误判为通过

## e2e 错误收集

建议统一接入 `e2e/ide/runtimeErrors.ts` 收集器，对 `console:error` 与 `exception`
做无新增错误断言。
