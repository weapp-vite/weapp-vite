---
'weapp-vite': patch
'create-weapp-vite': patch
---

优化 auto-import 在大量组件场景下的解析与支持文件同步性能。为内置 resolver 增加静态组件索引命中，减少重复的运行时 resolver 扫描；同时在 support files 与 manifest 内容未变化时跳过版本递增、重复写盘和联动输出重建，降低大项目中的构建与补全生成开销。
