---
"@mpcore/simulator": patch
---

修复组件通过 setData 打开弹窗时仅数据变化、界面未显示的问题。同步声明属性与 data，执行字符串方法形式的属性 observer，并按顺序调用 Behavior 和组件生命周期。保留组件自身更新的属性，避免无关父级渲染将其重置，保持 Node 与浏览器模拟器行为一致。
