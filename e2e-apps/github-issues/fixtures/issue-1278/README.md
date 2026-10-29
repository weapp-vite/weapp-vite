# Issue #1278

真实 `weapp-vite dev` 以 `weapp.hmr.runtime: 'classic'` 接管原本开启
`compileHotReLoad` 的项目。首次构建后仅强杀测试登记的 CLI，保留它生成的磁盘
journal；再次启动应恢复已死 owner 的请求配置并重新获取租约。

回归同时验证活跃 owner 不被抢占、恢复后的页面正常加载和原生按钮点击更新，以及正常退出后
原始配置恢复、journal 释放。测试不手工删除 journal，也不强杀微信开发者工具。
