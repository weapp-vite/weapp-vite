---
'@wevu/compiler': patch
'create-weapp-vite': patch
---

修复了 `defineOptions` 静态内联在模板项目中的编译问题：当配置对象中包含对象方法写法（如 `data() {}`）或内置构造器类型（如 `String`/`Number`）时，之前可能被错误序列化为不可解析代码或被误判为不支持的原生函数。此次同时收敛了 defineOptions 依赖提取范围，避免仅在方法体中使用的模块被提前求值导致构建失败。并同步保留零售模板的 TypeScript 路径映射配置，确保模板工程一致性。
