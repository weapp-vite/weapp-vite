---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复在 macOS 临时目录等真实路径与符号链接路径不一致时，布局解析与输出路径计算可能失效的问题。现在会对 `srcRoot`、`layouts` 目录与布局入口路径做更稳健的 realpath 归一化，避免 `app.vue`、Vue layout 与 native layout 在构建阶段出现布局找不到或产物路径错位。
