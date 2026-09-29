---
"weapp-vite": patch
"wevu": patch
"create-weapp-vite": patch
---

修复 stateful HMR 中 Tailwind 样式归属丢失导致完整重同步的问题。模板热更新重建 Wevu 组件时恢复运行时和交互状态，并在脚本补丁确认执行后提交样式，避免新样式被原生组件重建覆盖。

修复热更新抑制卸载生命周期时未停止旧 Wevu 实例的问题，清理其响应式任务及数据写入，避免已销毁的原生节点触发运行时错误。
