---
"weapp-vite": patch
"create-weapp-vite": patch
---

提前收集 worker 构建依赖，避免 macOS 原生 watch 在输出写入后新增监听时遗漏连续保存的 app 配置变更。保留 worker 语法错误后的输入监听、配置恢复和已发布产物清理边界。
