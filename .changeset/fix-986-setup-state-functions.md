---
'wevu': patch
'create-weapp-vite': patch
---

修复 setup 返回函数未写入 `setupState` 的问题，使 public proxy 与 `bindModel` 能读到同一份绑定。
