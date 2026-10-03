---
"wevu": minor
"create-weapp-vite": patch
---

为现有 setData 调试回调增加可选的 prepare、物理 dispatch 和 commit 阶段记录，关联 revision、合并后的物理调用、UTF-8 载荷字节及失败恢复结果。明确 callback、Promise、同步返回与可见视图的证据边界；默认关闭，不改变 nextTick 或现有提交屏障语义。
