---
"wevu": patch
"create-weapp-vite": patch
---

补齐 `wevu` 在 Vue `<script setup>` 中 `defineProps/defineEmits` 的类型兼容能力：`defineEmits` 现已支持数组、对象、函数重载与命名元组写法，并对齐官方 `EmitFn` 推导行为；同时增强运行时 `ctx.emit`，兼容 `emit(event, ...args)` 多参数形式并按小程序 `triggerEvent` 规范化 `detail/options`。另外新增 `wevu` 与 `weapp-vite` 的类型/编译回归测试，覆盖这些写法的编译与类型校验链路。
