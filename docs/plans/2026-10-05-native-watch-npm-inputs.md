# 原生 watch 的 npm 输入登记时序

## 复现与原因

全量回归发现，原生 Vite watch 从初始语法错误恢复后，紧随其后的脚本编辑可能没有进入 `watchChange`，产物停留在上一次内容。独立普通复跑没有稳定重现，但在恢复构建的 `writeBundle` 中加入屏障，等待产物写出后再次编辑再释放屏障，复现了相同的遗漏。

原实现到 `generateBundle` 才准备 npm 产物并调用 `addWatchFile`。Rolldown 在扫描后登记一轮监听，写出结束后还会登记渲染阶段新增的输入。macOS FSEvents 在新增监听目标时会暂停并重启事件流，留下写出期间编辑被遗漏的窗口。参考 [Rolldown v1.2.12 的监听实现](https://github.com/rolldown/rolldown/blob/v1.2.12/crates/rolldown_fs_watcher/src/watcher.rs)。

## 修改

在 `buildStart` 中准备并登记 npm 输入，使原生扫描阶段就能收集完整依赖。`generateBundle` 使用同一构建会话缓存的产物并调用 `emitFile`，`writeBundle` 继续发布受管的外部 npm 输出。开发服务器仍使用原有路径。

没有增加第二个 watcher，也没有手动重写最终 bundle。测试保留恢复构建期间的编辑，并用有界等待与 finally 释放屏障，确保失败时能关闭当前 watcher。

## 验证范围

验证钩子的输入登记与产物发布边界、原生 watch 的错误恢复及构建期间编辑，再重建包并运行 headless 与真实 IDE 的 Vite watch 场景。最终全量回归仍以同一提交上的单测、CI E2E、Web、headless 和真实 IDE 报告为准。
