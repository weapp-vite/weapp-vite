---
"wevu": patch
"create-weapp-vite": patch
---

修复 `useBindModel` 在 Vue SFC 中遇到 setup state 与 data 同名路径时写入目标不一致的问题，确保读取和更新都落在同一个响应式来源上。
