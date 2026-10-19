---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复状态化 HMR 入口拓扑重启期间旧会话继续处理源文件变更的问题，避免 DevEngine 关闭竞态导致构建取消并遗留过期的小程序配置产物。
