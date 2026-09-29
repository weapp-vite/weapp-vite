---
"weapp-vite": patch
"@weapp-vite/web": patch
"create-weapp-vite": patch
---

修复 Windows 下自动导入扫描与文件监听路径标识不一致导致的组件注册残留或元数据更新失配。修复 classic 开发模式的源码 JSON 缓存污染与增量 JSON 发布遗漏，删除组件或禁用组件声明后清除失效的页面绑定，并保留源码中的显式绑定。统一 Web Vue SFC 缓存的路径标识，避免重扫期间或重扫失败后因路径分隔符不同读取尚未发布的源码，保持模板、样式与脚本使用同一份已完成快照。
