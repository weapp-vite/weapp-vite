---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 stateful HMR 新增附属 JSON 依赖在首次侧车加载前再次保存时，输入账本与已生成资产使用不同版本的问题。检测到真实读取差异后由当前会话的完整重建事务重新发射产物，并保留原生监听、模块加载和会话清理的归属。
