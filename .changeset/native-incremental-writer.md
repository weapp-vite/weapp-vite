---
"weapp-vite": patch
"create-weapp-vite": patch
---

状态保持 HMR 的已编译增量文件直接通过 Rolldown 原生写出，避免每次发布重复解析 Vite 构建配置。首轮 public 复制、资产字节、删除归属和错误清理规则保持。
