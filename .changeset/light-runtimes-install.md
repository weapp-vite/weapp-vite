---
"wevu": patch
"@weapp-core/constants": patch
"@mpcore/simulator": patch
"@weapp-vite/i18n": patch
"@weapp-vite/react": patch
"@weapp-vite/web": patch
"@wevu/test-utils": patch
"@wevu/web-apis": patch
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

重构 Wevu 可选运行时能力的安装边界：编译产物会按模板元数据和应用选项显式安装所需能力，未使用 patch、模板 ref、内联事件、高频告警、作用域插槽或 layout 的小程序不再携带对应实现；公开 `wevu` 入口继续保留原有动态配置行为。

能力分析沿用配置初始化表达式所属的词法作用域，不再被调用位置的同名局部变量误导；提取后的作用域插槽组件也会依据自身 layout host 元数据安装 layout 能力。

按需 patch 与 diff 共用宿主提交跟踪，保证 setData 派发期间新增的 computed 变更不会丢失；清空模板 ref 绑定时会使旧异步查询失效，避免实例 `$nextTick` 读到已移除的引用。
