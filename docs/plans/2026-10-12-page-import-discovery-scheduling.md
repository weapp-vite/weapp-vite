# 页面 import 发现的有界调度

## 现象与边界

当前候选的 Stateful 资源验收在原 600000ms 总 deadline 的最后一次 fresh 观察失败，后续三轮没有执行。私有完整 512 页面冷启动记录中 create-server 为 10568.938ms，完整观察和资源收尾成立；这些本机数值不是远端门禁结果，也不能证明唯一超时根因。源码显示每个 options hook 串行完成页面入口解析、存在性检查、源码读取和本地 import 发现，然后才处理下一页面。

两个初始构建仍保留独立 context、resolver、graph 和 emit。不能通过删除独立构建、减少页面、扩大 deadline 或复用另一构建的 resolver 结果解决验收失败。

## 调度选择

采用每批最多 8 个页面的独立发现任务。每页仍按原先顺序执行入口选择、读取和 import 解析；批次结果按原 candidates 顺序归并，保持 importedComponents 首次出现顺序和后续 logical input 顺序。批次等待全部任务结束后才传播原 candidates 顺序的首个异常，避免已经启动的文件操作在 options 退出后继续悬空运行。

全量 Promise.all 会使 512 页面同时持有文件读取和解析任务；跨构建缓存需要额外的不可变输入、拓扑与生命周期证明。当前采用有界调度，不添加全局缓存、不共享 context，也不增加公开 API。后续 logical input 的插件 resolver 调用和图注册仍串行。

## 回归与验证

先用受控读取复现原调度的串行边界，断言最多 8 个活动读取和至少两个同时进入，按逆序释放读取后仍保持页面和组件声明顺序。覆盖缺失页面、读取失败、显式脚本导入、命名导入和目录优先级。各 options 调用重新读取文件；same-size 写入、原子替换和 symlink 改向不能命中跨轮缓存。

保留原测试断言。重建 weapp-vite 后才执行下游验证。完整 512 页面、15 步、四轮资源、原性能对数与唯一确认策略均保持不变；局部调度测试通过不代表资源或性能门禁通过。

将页面发现提取到 load/importedComponents.ts，避免继续扩大已有超过 300 行的 options.ts；options hook 继续持有 logical input 和图注册责任。
