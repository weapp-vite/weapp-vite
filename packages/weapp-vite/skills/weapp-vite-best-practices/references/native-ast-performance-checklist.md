# Native AST Performance Checklist

本表用于项目已接入自定义构建插件或评估 native AST 扩展时的设计判断，不要求普通消费项目修改构建器源码、安装 native 扩展或运行框架仓库 benchmark。常规性能排障先用项目相同输入的 build/HMR profile；没有扩展需求时保持现有构建路径。

- 一次调用传入完整源码、配置和分析任务，返回结构化摘要；不要逐节点往返 JS/Rust。
- native fast path 必须显式启用、可选依赖，加载、解析或运行失败时回退现有 JS/Babel/Oxc/Vue compiler 路径。
- 新增覆盖同时补 correctness 对齐测试和真实 HMR/build profile；没有 profile 不扩大迁移范围。
