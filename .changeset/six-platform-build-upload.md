---
"weapp-vite": minor
"create-weapp-vite": patch
"@weapp-core/logger": patch
---

新增微信、支付宝、抖音、小红书、京东、百度统一构建上传与预览命令，支持按需安装官方工具、环境变量凭据、显式多目标串行执行和只构建的 dry-run。预览调用各平台官方 preview 接口并返回二维码图片或预览链接，不以普通上传代替预览；两种操作均不包含提审或正式发布。

顶层 `wv upload`、`wv preview` 现由六端构建入口接管；原有微信开发者工具操作请迁移为 `wv ide upload`、`wv ide preview`。上传使用简短的 `--uv` 指定业务版本，默认读取 package.json.version；预览无需上传版本。同步脚手架使用指引。

支持通过 `weapp.upload.version` 与 `weapp.upload.desc` 配置上传默认参数，命令行参数优先。版本和说明保留字符串语义，避免纯数字、前导零或空白参数被错误转换。上传只在显式 `wv upload` 且本次构建与产物校验成功后触发；普通构建、开发重建、预览及 dry-run 不会触发上传。

修复日志包颜色工具导出声明泄漏 `picocolors/types` 内部路径的问题，NodeNext 类型检查使用正式包入口，无需额外配置依赖安装目录映射。
