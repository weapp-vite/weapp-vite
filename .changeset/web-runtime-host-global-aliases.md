'@weapp-vite/web': patch
---

继续增强 Web 运行时的小程序多平台桥接：`@weapp-vite/web` 现在会把同一套运行时 bridge 同步挂到 shared 平台注册表中的宿主全局对象（如 `wx`、`my`、`tt`、`swan`、`jd`、`xhs`），而不再只初始化 `wx`。这让支付宝、抖音、百度等宿主在接入 Web 运行时调试时，可以直接通过各自全局对象访问统一的路由、文件系统和 capability bridge。
