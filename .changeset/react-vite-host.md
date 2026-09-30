---
"weapp-vite": patch
"create-weapp-vite": patch
---

标准 Vite 插件与 Vite+ 开放微信 React 编译，复用既有静态/动态模板与原生、Wevu 组件互操作。修复自定义源码目录和符号链接路径下的 React 模板输出，并让宿主关闭等待正在重启的替换会话，避免关闭后继续写出。
