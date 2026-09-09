---
"wevu": patch
"create-weapp-vite": patch
---

隔离 setData 宿主载荷与内部序列化缓存、提交快照的对象引用，避免后续路径更新污染缓存，修复 computed 或 ref 切回初始对象时界面停留在上一状态的问题。
