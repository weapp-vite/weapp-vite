---
'@wevu/compiler': patch
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `app.vue` 中 `defineAppJson()` 在双 `<script>` 场景下对普通 `<script>` 绑定的读取缺陷。现在当普通 `<script>` 与 `<script setup>` 同时存在时，JSON 宏求值与 `auto-routes` 内联会一并覆盖普通 `<script>` 的顶层导入/声明，允许把 `import routes from 'weapp-vite/auto-routes'`、`import { pages, subPackages } from 'weapp-vite/auto-routes'` 这类写法放在普通 `<script lang="ts">` 中，再由 `<script setup lang="ts">` 里的 `defineAppJson()` 直接使用。
