---
"create-weapp-vite": patch
---

修复 `create-weapp-vite` 在发布前模板目录已部分存在且同步标记仍存在时会误跳过模板同步的问题，避免发布包只包含不完整模板文件。
