---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 Vue SFC HMR signature 计算，新增一次性解析并返回 non-json、script、style-independent 与 template 状态的批量接口，减少入口加载和 HMR 更新判断中的重复 signature 查询。
