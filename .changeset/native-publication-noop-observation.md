---
"@weapp-core/constants": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 为原生输出发布提供按目录与构建代次隔离的只读完成视图，复用已提交字节识别内容未变的增量构建。热更新验收可准确区分真实写出与无须重复写出的发布，并继续独立检查磁盘内容、正式构建完成和输出归属。
