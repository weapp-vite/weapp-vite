# API Mapping And Pitfalls

## 1) Page/Component 注册层

- 原生：`Page({...})` / `Component({...})`
- 迁移：`<script setup>` + JSON 宏 + wevu hooks/API

重点：迁移后不再直接写原生构造器，页面生命周期通过 `wevu` hooks 注册。

## 2) 状态更新层

- 原生：`this.data` + `this.setData({ ... })`
- 迁移：`ref/reactive` + 直接赋值

重点：

- 优先让 wevu 的 diff 负责最小更新。
- 避免把原生实例对象混入可序列化状态。

## 3) 组件契约层

- 原生：`properties` / `observers` / `triggerEvent`
- 迁移：`defineProps` / `watch` / `defineEmits`

推荐事件写法：

```ts
const emit = defineEmits<{
  change: [id: number]
  update: [value: string]
}>()
```

## 4) 原生实例方法访问

在 `setup(_, { instance })` 中使用原生实例能力：

- `instance.triggerEvent(...)`
- `instance.createSelectorQuery(...)`
- `instance.setData(...)`

迁移建议：

- 事件优先 `emit`。
- 数据更新优先响应式状态。
- `instance` 只作为桥接能力使用，不作为业务状态源。

## 5) 多平台能力分支

使用 `import.meta.env.PLATFORM` 做条件分支，避免直接假设 `wx` 始终可用。

```ts
if (import.meta.env.PLATFORM === 'weapp') {
  wx.showToast({ title: 'ok' })
}
```

## 6) 迁移阶段高频坑位

- 列表字段未兜底，导致 `map/forEach of undefined`。
- `usingComponents` 未迁移到 JSON 宏，组件不渲染。
- `query` 参数字符串化后未 parse，导致类型错乱。
- 只跑 dev 不跑 build，构建产物才暴露问题。
- e2e 未收集 runtime error，CI 误判为通过。

## 7) e2e 报错捕获建议

建议在 IDE e2e 统一接入 `e2e/ide/runtimeErrors.ts` 的收集器，对 `console:error` 与 `exception` 统一断言为无新增错误。
