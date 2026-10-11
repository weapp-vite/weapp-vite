---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复原生脚本监听通知晚于资产快照提交时的四文件批次，根据快照实际读取的脚本版本和已持久化版本，在真实通知到达后执行完整发布，保留资产稳定后独立脚本编辑的状态保持补丁。
