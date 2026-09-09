---
"create-weapp-vite": patch
---

修复插件模板在微信开发者工具插件开发模式下无法启动的问题。宿主小程序改用 `version: "dev"` 引用当前项目的本地插件，并保持 provider 与项目 AppID 一致。关闭插件项目的 IDE 二次 ES6 转译，避免重复 Babel 转换注入越过插件根目录的 helper 引用而导致白屏；同步修正仓库插件示例。
