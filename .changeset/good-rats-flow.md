---
"@weapp-vite/web": patch
"wevu": patch
"@weapp-core/constants": patch
"create-weapp-vite": patch
---

修复 Web 应用内联及外部样式的传播与热更新，保持组件样式隔离和主题继承；区分组件自定义事件与同名原生事件，避免一次点击重复回调；分离 setup 方法与属性桥接，保证同名 Boolean 属性及方法均可正常使用。
