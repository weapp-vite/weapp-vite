---
"weapp-vite": minor
"create-weapp-vite": patch
---

新增微信、支付宝、抖音、小红书、京东、百度统一构建上传与预览命令，支持按需安装官方工具、环境变量凭据、显式多目标串行执行和只构建的 dry-run。预览调用各平台官方 preview 接口并返回二维码图片或预览链接，不以普通上传代替预览；两种操作均不包含提审或正式发布。

顶层 `wv upload`、`wv preview` 现由六端构建入口接管；原有微信开发者工具操作请迁移为 `wv ide upload`、`wv ide preview`。上传使用简短的 `--uv` 指定业务版本，默认读取 package.json.version；预览无需上传版本。同步脚手架使用指引。
