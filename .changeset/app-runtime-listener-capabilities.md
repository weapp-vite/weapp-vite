---
'@weapp-core/shared': patch
'create-weapp-vite': patch
'wevu': patch
---

继续收敛多平台 App 级 runtime 监听 contract：在 `@weapp-core/shared` 的平台 descriptor 中补充 `onError`、`onPageNotFound`、`onUnhandledRejection`、`onThemeChange`、`onMemoryWarning` 等 App 级监听能力描述，并让 `wevu` 的 App 注册逻辑统一根据共享 capability 决定是否绑定宿主事件，而不是继续假设所有宿主都具备同一组 App 全局监听 API。这样后续新增平台时，App 级监听差异可以继续通过 descriptor 声明收敛，而不必反复修改 `wevu` 核心逻辑。
