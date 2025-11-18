---
"wevu": patch
---

wevu 运行时现在在调用 `createApp/definePage/defineComponent` 时直接注册原生实例， `.mount()` 只保留兼容用途，同时补充文档与示例说明新的无感挂载方式。
