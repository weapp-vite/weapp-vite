---
"@weapp-vite/web": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(web): 修复 Web 开发模式增删或恢复页面时入口缓存与路由扫描不同步的问题，确保浏览器重载后使用完整的新页面表，避免命名路由已更新却仍提示页面不存在。结构事件共用串行扫描与完整来源记录，避免重命名期间发布中间拓扑或遗漏同批小程序页面变更。
