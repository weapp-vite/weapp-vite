---
'wevu': patch
'create-weapp-vite': patch
---

修复 `wevu` 在小程序运行时 `setData` 快照与下发 payload 的引用污染问题：当 `computed` 返回对象并在模板读取其属性时，切换到其他引用再切回初始引用会被错误判定为未变化。现在会在内部快照与 `setData` 下发前做隔离拷贝，确保 `option.label` 这类绑定在引用往返后仍能正确更新。
