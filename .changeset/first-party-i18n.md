---
"weapp-vite": minor
"@weapp-vite/i18n": minor
"@wevu/compiler": minor
"@weapp-core/constants": minor
"create-weapp-vite": patch
"@mpcore/simulator": patch
"@weapp-vite/react": patch
"@weapp-vite/web": patch
"@wevu/test-utils": patch
"@wevu/web-apis": patch
"wevu": patch
---

新增可脱离 Vite 使用的 `@weapp-vite/i18n` 运行时、编译器、原生 catalog 命令和微信构建 npm 入口，并由 weapp-vite 提供 locale JSON 扫描校验、简单占位符预编译、WXS 模板改写、Native 与 Vue/Wevu 接入、HMR，以及主包、普通分包和独立分包的资产与实例边界。
