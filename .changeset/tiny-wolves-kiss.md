---
"wevu": patch
"create-weapp-vite": patch
---

对齐 `wevu` 对外 `PropType<T>` 的类型行为到 Vue 官方定义，支持 `type: [String, null]` 等构造器数组写法，并修复该场景下 `InferPropType` 对 `null` 推导退化为 `any` 的问题，保证与 Vue utility types 的使用体验一致。
