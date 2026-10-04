---
"weapp-vite": patch
"create-weapp-vite": patch
---

统一插件声明的外部监听依赖路径，确保 Windows 原生分隔符与不同盘符的输入在 HMR 快照中使用一致身份，并继续校验新发现依赖的内容版本。
