---
"@mpcore/simulator": patch
---

fix(simulator): 修复 WXML include 内容未参与渲染的问题，支持相对路径、嵌套引用、组件绑定和修改恢复，并检查循环引用。新增显式 reloadPageDefinition 接口，按页面入口的源码字节更新已加载定义，保留 App 和共享依赖缓存，失败时恢复模块缓存与注册表；普通导航继续使用原有缓存。
