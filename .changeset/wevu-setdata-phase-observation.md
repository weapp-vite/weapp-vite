---
'create-weapp-vite': patch
'wevu': minor
---

feat(wevu): 为 setData 调试回调新增可选 prepare、dispatch 和 commit 阶段观察。

- setData 调试回调可选记录 prepare、物理 dispatch、commit、revision、合并调用、UTF-8 字节和失败恢复。默认关闭，保留 nextTick 与提交屏障语义，明确 callback、Promise、同步返回和可见视图的证据边界。
