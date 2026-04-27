---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化开发态 HMR 的 shared chunk 扩散策略：入口文件自身更新时不再因为历史共享运行时或 vendor chunk 反向重发所有入口，依赖变更驱动的共享模块更新仍会扩散到相关 importers，从而降低模板页面热更新耗时。
