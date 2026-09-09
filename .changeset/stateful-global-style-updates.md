---
"@weapp-core/constants": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复微信状态保持热更新直接修改全局样式时触发完整重载的问题。通过稳定的 app.wxss 导入同目录样式资产，让全局样式变化保留页面和 App 实例；原有样式导入及资源相对路径保持不变，classic 构建行为不受影响。
