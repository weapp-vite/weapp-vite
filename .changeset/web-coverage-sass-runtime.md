---
"@weapp-vite/web": patch
"@wevu/web-apis": patch
"@wevu/compiler": patch
"create-weapp-vite": patch
---

fix(web): 修复 Web 覆盖率在 Vitest 5 中漏采集源码的问题，补齐 Web 运行时、Web API 和命令入口的边界回归，并合并由内部输入约束保证的重复兜底。

修复现代 Sass 编译接口未按缩进语法处理 `lang="sass"` 的问题，保留 SCSS、预处理配置及模板构建行为。
