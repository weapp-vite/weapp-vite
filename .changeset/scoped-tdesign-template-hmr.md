---
"create-weapp-vite": patch
"weapp-vite": patch
---

优化默认 `auto` 模式下的 HMR 入口收敛逻辑。直接编辑页面或组件入口时，不再因为稳定公共 chunk 的 importer 很多而扩散成大量入口重新构建；普通旁路模板、样式、JSON 更新也不再强制 full shared chunk refresh，同时保留依赖驱动、layout、配置类和旁路拓扑变化的跨入口刷新能力。
