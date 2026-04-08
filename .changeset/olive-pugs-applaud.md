---
'weapp-vite': patch
'@wevu/compiler': patch
'create-weapp-vite': patch
---

默认将 wevu 配置缓存写入项目内的 `.weapp-vite/wevu-config`，并同步忽略该内部目录，避免临时文件再次参与监听、路由扫描与源码排除逻辑。
