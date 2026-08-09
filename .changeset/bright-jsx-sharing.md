---
'@wevu/compiler': patch
---

支持从相邻 JSX/TSX 模块导入并复用静态 JSX 片段、JSX 工厂函数以及经过 barrel 文件 re-export 的 JSX 片段。编译器会在生成 WXML 前解析这些导出，并对工厂参数生成稳定的模板表达式。
