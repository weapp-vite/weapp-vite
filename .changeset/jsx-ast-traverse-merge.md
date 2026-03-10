---
'@wevu/compiler': patch
---

优化 JSX 编译流程：合并重复的 Babel AST 遍历，将 compileJsxFile 中对同一源文件的多次 babelParse 和 traverse 合并为单次解析和单次遍历，减少编译开销。
