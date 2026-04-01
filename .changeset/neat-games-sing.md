---
'@wevu/compiler': patch
---

为 Vue SFC 的双脚本场景补充 `lang` 一致性校验：当同一个文件同时声明 `<script>` 与 `<script setup>` 时，`@wevu/compiler` 现在要求两者的 `lang` 完全一致，否则会在解析阶段直接抛出明确错误，避免后续编译链路在混合脚本语言下出现不一致行为。
