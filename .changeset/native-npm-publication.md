---
"weapp-vite": patch
"create-weapp-vite": patch
---

为标准 Vite 与 Vite+ 插件接入 npm 自定义构建回调和手工输出映射，复用依赖编译器并由宿主原生发布产物；按整轮绝对文件归属清理陈旧输出，避免父子映射迁移误删当前文件，并修正映射 sourcemap 与依赖失败时的中间目录生命周期。手工关联从所选 manifest 解析依赖，递归依赖遵循父包的 Node 查找语义，缓存同时跟踪该 manifest 的变化；保持回调的工程根目录与最终输出路径契约，并补全返回 `false` 跳过依赖的公开类型。
