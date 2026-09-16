---
'@wevu/compiler': patch
---

为不支持的对象形式 `v-bind` 和 `v-on` 输出带源码位置的编译诊断，避免属性与事件被静默丢弃。
