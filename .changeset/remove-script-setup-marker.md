---
"@wevu/compiler": patch
---

移除 Vue SFC `<script setup>` 编译产物中运行时未使用的 `__isScriptSetup` 标识，减少每个 SFC 额外生成的无效代码体积。
