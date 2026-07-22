---
'@mpcore/simulator': minor
'create-weapp-vite': patch
'weapp-vite': patch
---

修复 stateful HMR 对脚本 sidecar 源文件的边界识别与更新传播，增强 mp core 模拟器的宿主 `wx` 调用、页面方法超时、路由元数据和页面生命周期栈语义，使真实微信开发者工具与 headless 测试在导航及运行时状态上保持一致。
