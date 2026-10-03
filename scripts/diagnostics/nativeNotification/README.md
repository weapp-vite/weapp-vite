# Native source notification diagnostic

此目录仅存在于临时诊断分支，不进入 main 或正式性能采样入口。

Workflow 使用两个 checkout：product 固定为 a88e9e260ccc684f4cf3501a38fc919d3a63cc42，driver 使用本分支的精确 SHA。产品安装和重建自己的依赖闭包后，将此目录复制到 product 的 ignored `.tmp/native-source-notification-probe` 中执行。模块只通过 Node load hook 在内存中转换，正式源码、dist、锁文件和官方 native binding 保持不变。

每个独立 dev 会话先运行 `app-json`，再运行 `native-page-script`；各含首次 edit/restore 与 repeat edit/restore。Control 和 probe 串行运行，只有原生脚本窗口开启观察。既有 mutation、output、acknowledgement、profile、heap 与 settle 顺序保留。正式 20 组配对、冻结 baseline 与相对门槛不参与本诊断，也不被修改。既有 500 ms 绝对预算和全部 timeout 保留；如正式 collector 一样，绝对超预算单独记录，功能失败/插桩失败/输出不等价各自阻断，不把它们混称为性能验收通过。

观察点区分 Vite Chokidar receipt、Vite container dispatch、native→JS plugin callback、core normalize/invalidation/notify，以及 session.source。Native callback 已位于原生检测、协调器排队、bundler 锁和前序原生插件之后，不能称为 OS watcher receipt。ALS 只保存标量身份，不持有 compiler context 或 native 对象。事件有界并在 overflow 时拒绝使用数据；成功 transport history 和原始失败均保存。

跨进程时间采用 inspector 往返得到的 offset 区间，不假设 performance.now 的原点相同。Observation window 不是随原生事件传递的 mutation ID：晚到或重复通知必须显式分析，不能按最近时间自动宣称因果配对。窗口外 inspector、完整产物读取会影响后续 polling 相位，因此本结果仅用于定位边界。

产物按文件名和代码字节比较。只在明确的 control 对象、full-build 注释、update header 中映射随机 buildId、token、端口和 nonce，其余差异失败保留，不做泛化路径或源码映射归一化。

文件职责：`prepare.mjs` 和 `transform.mjs` 验证模块形态与 hash；`preload.mjs` 和 `sink.mjs` 提供内存观察；`prepareHarness.mjs` 生成私有驱动；`driver.mjs` 保留窗口和输出；`runPair.mjs` 串行执行及收尾；`compare.mjs` 严格比较；`analyze.mjs` 输出边界时长；`selfCheck.mjs` 验证静态语法、异步归属、容量与比较器。

此诊断不会运行 Rust build、替换正式 binding、修改生成物，也不替代真实 Stable DevTools 最终验收。
