---
"weapp-ide-cli": patch
---

fix(weapp-ide-cli): 让受管项目日志读取支持取消信号，取消后停止遍历后续记录和子日志，保留原有作用域与身份校验。
