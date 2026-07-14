---
"@weapp-vite/vscode": patch
---

重构小程序模板格式化器为无损容错扫描与输出流程，避免属性比较表达式、混合文本、内联 WXS/SJS、CDATA 或平台特有语法被误改；同时为 AXML、TTML、Swan、JXML、QML、KSML、XHSML 与 TyML 启用统一格式化能力，无法可靠解析时保持原文不变。
