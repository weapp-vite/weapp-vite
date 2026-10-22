---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix: classic 更新在 tree-shaking 前编译当前有效注册图，避免局部共享 runtime 丢失仍被页面、组件或布局使用的导出。完整图不受代表入口或元数据优化裁剪，最终产物仍按字节去重并由构建器写出。
