---
"@weapp-vite/miniprogram-automator": patch
---

修复新版微信基础库 XPath 多节点查询直接返回数组时的协议解析，兼容旧版 elements 包装格式，并继续对缺失或异常响应报错。单节点查询正确保留新版基础库的未匹配 null 结果。
