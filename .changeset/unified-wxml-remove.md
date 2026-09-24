---
"weapp-vite": major
"@wevu/compiler": minor
"create-weapp-vite": patch
---

新增统一的 `weapp.wxml.remove` 最终模板清理入口，支持精确及通配符属性规则、标签限定属性、显式整节点删除和普通注释清理。原生模板、Vue SFC、组件与分包使用同一清理阶段，并保护平台指令、事件及框架运行时元数据；不安全的结构删除提供文件位置诊断。

清理器分别处理微信现行 WXML 双层转义与其他平台的 XML 属性边界，保护下划线或数字开头的自定义事件、原生插槽别名及类名/样式绑定。通配符采用有界匹配，避免重复星号触发正则回溯；纯注释清理复用词法边界而不分配清理用的元素树，也不重复执行平台归一化。

WebView glass-easel 专项适配延期，等待官方正式支持后再实现；依赖最新 nightly 的实验配置不纳入本次支持和验收范围。

Vue 编译器新增 `preserveComments` 选项，让构建工具在最终输出阶段统一决定注释清理。独立调用编译器的默认注释行为不变。

迁移说明：从用户配置类型中移除原先未生效的 `weapp.wxml.removeComment` 和 `weapp.vue.template.removeComments`，统一迁移到 `weapp.wxml.remove.comment`，不保留别名。未配置 `remove` 时维持历史普通注释清理，不新增属性或节点删除；`remove: true` 不隐含生产环境限制。由于旧配置字段的类型移除属于不兼容变更，`weapp-vite` 按主版本发布。
