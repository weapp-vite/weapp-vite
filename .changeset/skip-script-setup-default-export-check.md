---
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 Vue SFC 脚本阶段的默认导出检测：普通 `<script>` 无 `export default` 时先通过文本快拒跳过 Babel parse，`<script setup>` 编译结果不再重复扫描默认导出，减少常见组件编译与 HMR 中的无效 AST 成本。
