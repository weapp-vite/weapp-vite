---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复默认 autoRoutes 对分包根目录的误扫描：当分包内已经存在 `pages/` 目录时，不再把分包入口脚本误识别为页面并写回 `subPackage.pages`；同时去重独立分包 `entry` 与 plugin export 重叠时生成的重复 entries，并补充对应回归测试。
