---
"wevu": patch
"create-weapp-vite": patch
---

修复 `wevu` 在 `createApp().mount()` 返回值上的类型冲突：`RuntimeInstance` 不再在对象字面量直接声明内部字段 `__wevu_touchSetupMethodsVersion`，改为运行时按不可枚举属性注入，消除 TypeScript 报错且不暴露内部实现细节。同步补充并修正 `tsd` 类型测试，覆盖 `RuntimeInstance` 的 `state/computed/methods/proxy/watch/bindModel` 推导行为，以及内部字段不可访问约束，确保类型契约在构建与消费场景下稳定。
