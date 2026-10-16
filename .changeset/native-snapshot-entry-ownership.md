---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复状态保持 HMR 快照在入口身份登记前读取页面脚本，导致原生伴随样式的导入未展开、样式更新失效的问题。入口解析后立即登记真实源码身份，并保留已有的解析元数据和目录组件资产。
