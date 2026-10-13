---
"@weapp-core/shared": minor
"@mpcore/simulator": patch
"@weapp-vite/web": patch
"@weapp-vite/miniprogram-automator": patch
---

修复 headless 原生控件的渲染与默认提交能力：

- Node/browser 共用原生 form submit 默认动作，保留按钮禁用、catch 路径、组件/插槽归属、折叠宿主事件与异步结果边界；具名原生字段从当前渲染绑定收集，picker 数组不再依赖字符串反推。
- 后续原生监听器同步失败时仍收尾已启动的异步处理；多个失败通过带原始 cause 的 AggregateError 保留，不遗留未处理的 Promise 拒绝。
- WXML 保留 XML 节点结构，避免 HTML 解析规则丢弃嵌套表单。
- rich-text 的结构化节点和 HTML 字符串生成可观察的惰性渲染内容，支持替换与清空，不执行 WXML、事件或伪造的模拟器元数据。
- 浏览器预览阻止富文本链接和 HTML 表单的额外默认导航，保留模拟器自己的 tap/submit 分发；冷启动浏览器验证提前发现依赖，避免测试中途重新优化和重载。
- 新增独立的 `@weapp-core/shared/rich-text` 安全树子入口，迁移 Web 现有规则供模拟器共同使用，根入口不加载 HTML 解析器。

此变更不补齐未绑定输入状态、自定义 form-field 值导出、reset 或真实 formId 上报；headless 与浏览器验证不替代微信 IDE、真机验收。
