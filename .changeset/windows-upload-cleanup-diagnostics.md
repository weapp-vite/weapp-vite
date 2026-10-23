---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(upload): 补充 Windows 本地上传进程清理失败时的阶段和耗时诊断，区分 PowerShell 启动与进程查询，并限制错误输出以避免回显原始命令和进程诊断。保留原有超时预算和子进程清理规则。
