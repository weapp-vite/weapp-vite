# Tailwind 扫描范围与批次样式交付

## 已复现的问题

消费者把整个 `node_modules` 目录链接到共享依赖树时，HMR 使用项目根作为无 compiled root 时的扫描基准，而 core 使用解析后的 CSS 来源基准。带显式 `@source` 的 CSS 入口因此可能触发依赖树的额外遍历与真实路径解析。默认自动扫描可以由 core 返回显式项目范围，必须保留，不能统一缩小到 CSS 入口目录。

另一个独立问题位于批次交付：当前实现先发布脚本、通知已交付，再提交最终 CSS。最终 CSS 写入失败时，脚本已经执行，无法满足 #1081 要求的失败不发布、不通知。

## 实现选择

来源范围沿用上游 resolver 和 compiled source entries，不新增公开接口。HMR 保存解析后的内部请求副本与有效来源集合；首次发现、新增文件及内存重新编译使用一致基准，保留多个 root、显式来源、默认自动扫描、`source(none)`、符号链接和输出排除语义。原始生成请求与结果保持不变。

批次交付恢复为准备固定输入、成功提交最终 CSS、发布脚本、实际执行确认后通知已交付。移除脚本执行后才写必需 CSS 的第二次提交。写入失败沿既有队列和完整重同步路径恢复，样式比较基准仍为实际成功提交的内容。

没有采用拼接两代 CSS：相同 selector、主题变量和 CSS Modules 无法同时表达两代语义；先拼接再发布后的必需清理写入也无法保证失败不发布。

## 验证与完成边界

定向测试覆盖有效来源范围、完整依赖目录符号链接、多个 CSS 输入、新增来源及默认扫描保留；修正后的复现须独立比较旧实现失败与新实现通过。

交付测试覆盖样式写入延迟期间不发布、不通知，写入失败不发布、不通知，后续完整重同步和下一批恢复，多补丁顺序及无变化 CSS 不重复写入。保留既有 runtime 原断言、性能基线、预算及 deadline。

源码单测后重建受影响包，再串行执行下游验证。真实 IDE 的透明样式仍需同一轮节点 class、已加载 stylesheet 与可见结果证据；本次交付顺序修复不能单独证明其根因。Windows 启动超时及性能回退也须保留原门禁复验。

`session.ts` 和既有 snapshot harness 已超过 300 行。本次仅删减第二次提交并在既有测试边界补充回归，不增加新的生命周期；大规模拆分会扩大状态所有权变更，因此留待独立重构。

HMR adapter 在补充 root watcher、registration token 和异步交付门禁后约 329 行；已将失效集合、owner epoch 和导入式 root 登记拆成私有模块。其余代码是同一 adapter hook 的共享状态编排，继续拆分会复制 dispose、watcher 和 snapshot 所有权，暂保持集中并在后续生命周期重构时处理。

## 普通候选内容的失效时机

完整内存输入已经足以让 core 更新新增、替换、删除及空来源候选，单纯内容保存无需先重建 Tailwind engine。现有即时 `invalidate` 会在第一次从磁盘扫描切到内存生成时额外重建 engine。保留即时失效最简单，但会继续承担该次重复工作；永久跳过失效则不可接受：原生候选和 `app.json` 入口同时变化、首批直接走完整快照时，相同磁盘生成请求会命中旧 output cache，负控已复现旧候选残留。

采用私有的延迟失效集合，仅接纳已在宿主完整输入视图中捕获、命中有效 source matcher、且不属于任何 CSS 输入或已知依赖的普通候选。core 返回的 import、config、plugin 依赖及预处理 metadata 依赖仍即时失效；未知分类、未初始化 root、导入式样式、classic 和一次性 snapshot 保持即时失效。集合保存 root ID，避免不断新增、删除候选文件导致路径队列增长，也保证内存生成清空上游扫描来源后仍可显式失效原 root。

两个磁盘生成入口统一经过私有 wrapper，在同一同步段取出待失效 root、调用 core `invalidate`、清除已处理项并提交 `generate`；内存 prepare 不处理此集合。多个 root 分别保留身份，删除入口同时移除对应 adapter root 和待失效项。生成失败沿用 core 尚未提交的失效状态；dispose 清除本实例集合和 adapter 状态，不影响其他 snapshot 或 controller。

回归按真实 plugin hooks 验证首次普通内容更新的 engine 复用，同时以 fresh compiler 的 CSS、classSet 作为正确性对照。补充磁盘与内存交替、完整重同步、来源删除、CSS/config/import 与内容同时更新、多个 root、冻结批次、classic、独立 snapshot 和释放覆盖。诊断 timing 不充当正式性能通过证据，原性能基线、预算和 deadline 保持不变。

异步生命周期使用私有 owner epoch。普通内容更新和同一入口的重新登记沿用活跃 owner；入口删除、同索引换成另一 root 和 adapter dispose 会撤销旧 owner。冻结的 prepare scope 通过稳定的 compiler facade 在每个 root 进入 core.generate 前检查 owner，并在生成及样式 render 返回后再次检查，避免删除期间恢复 core root、发布过期 CSS 或以新 owner 复活旧请求。磁盘生成在进入 core 前登记 generation token，删除或更新登记后迟到的生成及来源扫描均不能写回 adapter。

导入式样式在首次 core.generate 前登记私有 owner；生成失败、提交后异常和处理期间保存都继续按导入式完整重同步处理，只有对应 core.remove 完成后才撤销该登记。同一导入 key 的每次生成保留独立 generation，旧 transform 完成后不能覆盖新 snapshot。

## 一次性快照的目录监听所有权

开发语义的一次性编译快照此前也会创建常驻 source sidecar watcher，完整快照因此登记了额外目录订阅。监听是否属于当前宿主改由已解析的生命周期决定：`serve` 或 `build.watch` 持有目录监听；尚无已解析配置时，只接受明确的原生 `watchMode`。开发编译语义仍由原有配置控制，不再隐含持续监听。

app、plugin 和 subpackage 使用同一创建条件，持续宿主复用既有 watcher。一次性快照保留配置、原生 WXML 和 plugin JSON 的 `addWatchFile` 构建依赖，不创建独立目录订阅；关闭快照也不释放其他活跃宿主的监听。

回归使用惰性的 watcher 替身检查创建次数、复用和释放所有权，覆盖一次性编译、持续 serve、watch build 及三个入口形态。这些测试证明生命周期契约，不证明正式性能门禁改善；性能结论仍须来自原基线、预算、deadline 和真实输入路径的完整运行。

`watch.ts` 已超过 300 行。本次仅收窄现有 watcher 创建分支，不增加状态机或新的资源层。拆分整个监听生命周期会扩大无关所有权变更，留待独立重构。
