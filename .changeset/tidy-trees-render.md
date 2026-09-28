---
"@mpcore/simulator": patch
---

修复父子组件共享对象属性引用导致深层更新无法刷新递归组件的问题，保持 Node、浏览器 simulator 与真实微信运行时的属性传递行为一致。
