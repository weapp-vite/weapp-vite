---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化入口加载阶段对已解析配置与模板候选文件的监听注册，避免对已经命中的文件再次执行存在性探测，降低构建与 HMR 热路径中的重复文件系统查询。
