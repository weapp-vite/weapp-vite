---
"weapp-vite": minor
"create-weapp-vite": patch
---

新增微信、支付宝、抖音、小红书、京东、百度统一构建上传命令，支持按需安装官方工具、环境变量凭据、显式多目标串行上传和只构建的 dry-run。上传不包含提审或正式发布。

顶层 `wv upload` 现由六端构建上传入口接管；原有微信开发者工具上传请迁移为 `wv ide upload --project <项目目录> -v <版本> -d <描述>`。新入口使用 `--upload-version` 指定业务版本，并同步脚手架使用指引。
