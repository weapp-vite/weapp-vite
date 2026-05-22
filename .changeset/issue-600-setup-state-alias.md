---
'@weapp-core/constants': patch
'@wevu/compiler': patch
'wevu': patch
'create-weapp-vite': patch
---

修复 `<script setup>` 中 props 解构别名与同名 setup 绑定混用时的运行时和编译期分层问题，保证 props 别名、setup 本地状态与原始 props 可以分别更新，并让 issue #600 的页面在 IDE 与生成产物中保持一致。
