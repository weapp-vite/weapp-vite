---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复抖音小程序项目混用不同版本 `wevu` 时的运行时兼容问题，构建期间优先绑定 `weapp-vite` 配套的 `wevu` 副本，并增加版本不一致预检提示；同步更新脚手架版本联动。
