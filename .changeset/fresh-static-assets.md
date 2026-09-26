---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复开发模式 public 资源后续更新和新增未同步、复制资源删除后旧产物残留的问题。保留编译产物的覆盖优先级，并在资产写出失败或被后续编辑取代后正确恢复原始内容。
