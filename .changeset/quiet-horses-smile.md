---
'create-weapp-vite': patch
'weapp-vite': patch
---

开发态现在会保留并监听 `build.watch.include` 的外部路径，同时把配置文件依赖纳入重建；`srcRoot` 之外的已解析组件也会进入编译与 HMR 流程。
