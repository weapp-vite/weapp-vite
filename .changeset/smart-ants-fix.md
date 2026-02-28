---
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `app.vue` 中 `<script setup>` 的 `defineOptions` 不能引用局部变量或导入变量的问题，并统一增强宏配置提取体验：

- 新增 `defineOptions` 参数静态内联能力，支持引用本地声明与跨文件导入（包含 `weapp-vite/auto-routes` 顶部静态引入场景）。
- `auto-routes-define-app-json` 示例改为单 `script setup`，同一份 `routes` 同时用于 `defineAppJson` 与运行时 `globalData`。
- 补充单元测试与 e2e 测试，覆盖 JSON 宏和 `defineOptions` 对局部/导入变量的兼容性与热更新回归。
