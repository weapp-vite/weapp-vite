---
'@weapp-core/constants': patch
'@wevu/compiler': patch
'wevu': patch
'create-weapp-vite': patch
---

修复 `<script setup>` 中 props 解构别名与同名 setup 绑定混用时的运行时和编译期分层问题，保证 props 别名、setup 本地状态与原始 props 可以分别更新，并让 issue #600 的页面在 IDE 与生成产物中保持一致。同时让 class/style/v-show 运行时 fallback 在首帧对象尚未就绪时静默回退，避免 issue #322 场景在 IDE 控制台输出模板表达式异常。
