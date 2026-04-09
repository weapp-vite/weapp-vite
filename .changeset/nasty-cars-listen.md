---
'@wevu/compiler': patch
---

修复 Vue SFC 模板中 `import.meta.env` 无法通过模板解析的问题。现在 `<template>` 里的 `import.meta.env` 表达式会保留到后续 WXML 产物阶段继续做静态替换，不再在 `compileVueFile` 阶段提前报错，并能与 WXML 侧的引号修正策略协同生效。
