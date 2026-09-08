---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复微信状态保持 HMR 下 Wevu Component 页面使用 `apply-shared` 时，全局样式更新后界面仍显示旧样式或透明背景的问题。根据页面注册选项及最终 JSON 配置生成页面自包含的全局样式快照，保留相对资源路径、页面局部样式优先级和交互状态，独立分包保持原有样式边界。

状态保持 HMR 的增量资产写入不再重复复制 public 目录，避免静态资源覆盖本次编译产物。
