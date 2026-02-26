# Vue 能力兼容性对照（wevu-vue-demo）

来源：`https://vuejs.org/llms.txt`（通过 `llms-full` 中的 Script Setup / Reactivity / Template 相关章节整理）

## 目录

- `pages/vue-compat/index`
- `pages/vue-compat/template/index`
- `pages/vue-compat/reactivity/index`
- `pages/vue-compat/script-setup/index`
- `pages/vue-compat/matrix/index`

## 本地验证命令

- `pnpm --filter wevu-vue-demo typecheck`
- `pnpm --filter wevu-vue-demo build`
- `pnpm eslint apps/wevu-vue-demo/src --ext .ts,.vue`

## 结果摘要

- 模板语法：通过
- 响应式：通过（含 writable computed、多源 watch cleanup、effectScope、customRef、markRaw、toRef/toRefs）
- script setup 宏：通过
- 能力矩阵：已建立（见 `pages/vue-compat/matrix/index`）

## 详细矩阵

| 分类         | 能力              | 示例                                       | 结论    | 备注                                                       |
| ------------ | ----------------- | ------------------------------------------ | ------- | ---------------------------------------------------------- |
| template     | 条件渲染          | `v-if / v-else`                            | pass    | 页面分支渲染正常                                           |
| template     | 列表渲染          | `v-for + :key`                             | pass    | 列表迭代正常                                               |
| template     | 双向绑定          | `v-model`                                  | pass    | 输入与状态同步正常                                         |
| template     | 动态绑定          | `:class / :style / @tap`                   | pass    | 绑定与事件正常                                             |
| reactivity   | ref               | `ref() / ref(value)`                       | pass    | 已支持无参 `ref()`                                         |
| reactivity   | 核心 API          | `reactive / readonly / computed`           | pass    | 行为与类型通过                                             |
| reactivity   | 侦听 API          | `watch / watchEffect`                      | pass    | 行为与类型通过                                             |
| reactivity   | 浅层响应          | `shallowRef + triggerRef`                  | pass    | 手动触发更新可用                                           |
| script-setup | 组件宏            | `defineProps / defineEmits / withDefaults` | pass    | 类型推导正常                                               |
| script-setup | model 单 Ref 形态 | `const m = defineModel()`                  | pass    | 可用                                                       |
| script-setup | model tuple 形态  | `const [m, mods] = defineModel()`          | pass    | 已支持 tuple 解构与 modifiers 泛型推导                     |
| component    | 动态组件          | `<component :is=\"Comp\" />`               | partial | 当前构建链对跨文件 `.vue` 动态组件存在 default export 问题 |
| component    | 组件互操作        | `native usingComponents -> Vue SFC`        | pass    | 原生组件可通过 usingComponents 引入并渲染 Vue 组件         |
| build        | 工程校验          | `typecheck + eslint + build`               | pass    | 当前对照目录全通过                                         |

## 已观察到的差异

1. `component :is` + 跨文件 `.vue` 组件在当前构建链会触发默认导出解析问题；本对照页改为 `v-if / v-else` 静态组件切换。
