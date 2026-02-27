---
"@wevu/compiler": patch
---

在编译器文件读取与 SFC 解析链路中统一将 `CRLF/CR` 归一化为 `LF`，从框架层消除 Windows、Linux、macOS 的行尾差异；同时补充底层缓存读取与 `compileVueFile` 的跨行尾一致性测试，避免用户项目未配置 `.gitattributes` 时出现解析/匹配不一致问题。
