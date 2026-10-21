---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(hmr): 修复状态保持 HMR 在 DevEngine 返回 Noop 时丢失编译器已捕获的原生 Vue 样式与模板更新的问题，使用同一批次的冻结输入完成编译和恢复，并继续校验模板注册能力，避免仅因 JavaScript 没有补丁而遗漏视觉资源发布。

完整输出写出期间源码再次变化时保守回退 classic，避免将新源码误记为旧产物的已发布基线而遗漏快速保存。
