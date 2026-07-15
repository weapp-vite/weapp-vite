# Native AST Performance Checklist

- 一次调用传入完整源码、配置和分析任务，返回结构化摘要；不要逐节点往返 JS/Rust。
- native fast path 必须显式启用、可选依赖，加载、解析或运行失败时回退现有 JS/Babel/Oxc/Vue compiler 路径。
- 新增覆盖同时补 correctness 对齐测试和真实 HMR/build profile；没有 profile 不扩大迁移范围。
