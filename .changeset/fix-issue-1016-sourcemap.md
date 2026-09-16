---
"@wevu/compiler": patch
---

修复换行符、`defineOptions` 与 JSON 宏预处理后的脚本源码映射，使后续声明准确指向原始 Vue SFC 并保留原始内容。
