---
"@mpcore/simulator": patch
---

fix(simulator): 对齐微信原生组件的属性和数据共享语义，未声明的宿主属性不再进入组件实例，同值的自身属性写入只通知数据监听器，避免 scoped-slot 挂载期间重复进入属性监听器导致绑定丢失。
