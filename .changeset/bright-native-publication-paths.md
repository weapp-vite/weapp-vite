---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 Windows 原生输出发布观察的目录键不一致，读取和等待发布时统一解析目录路径，避免反斜杠路径无法匹配已写入的输出范围，同时保留其他目录和旧构建代际的隔离。
