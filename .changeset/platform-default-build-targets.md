---
'@weapp-core/shared': patch
'weapp-vite': patch
'create-weapp-vite': patch
---

将小程序平台默认 `build.target` 收敛到 shared 平台描述中，后续新增平台时可直接在 descriptor 中声明默认构建目标，而不必继续修改 `weapp-vite` 内部平台表。
