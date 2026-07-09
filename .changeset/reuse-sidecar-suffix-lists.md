---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化侧车文件监听和 HMR 脏标记的后缀判断，复用预计算后缀列表以减少热路径临时数组分配。
