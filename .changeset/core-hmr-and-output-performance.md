---
"weapp-vite": minor
"create-weapp-vite": minor
---

系统优化开发态 HMR 与输出生成链路：收敛 shared chunk、模块图、CSS importer、WXML/WXS 和 Wevu runtime 的重复扫描，复用入口、依赖图与 bundle 索引，并通过代表入口和精确输出目标缩小增量重建范围。共享脚本、样式、Tailwind 内容与模板依赖更新会减少无关入口编译和重复产物写入，降低大型项目持续开发时的热更新延迟。
