---
"@mpcore/simulator": patch
"@weapp-vite/miniprogram-automator": patch
---

fix(simulator): 对齐静态 WXML 空白语义并同步无头自动化运行时。

在插值前移除静态 ASCII 纯空白节点，保留显式绑定空格、非空文本和 WXS 正文。Node、浏览器及 testing fallback 统一使用同一模板解析规则，并同步 automator 内联的运行时副本。
