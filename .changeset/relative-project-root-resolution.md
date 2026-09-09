---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复通过相对项目目录启动 CLI 或加载配置时，Windows 包解析误将目录识别为网络路径的问题。配置加载入口统一使用绝对项目根目录，保持配置文件与输出目录相对于项目的解析规则。
