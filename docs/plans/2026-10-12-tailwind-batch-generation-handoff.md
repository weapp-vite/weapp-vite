# Tailwind 批次生成结果与独立交付快照

## 复现与范围

Stateful HMR 在 provider preparation 中从完整封存输入生成 Tailwind 候选；需要资产快照时，独立快照的 output hook 再生成一次，随后批次编译还会用 provider CSS 覆盖同名快照样式。真实 compiler 调用计数的最小集成复现证明，两边输出语义一致时，独立快照仍执行第二次 generate。

正式固定性能报告存在已确认回退，但原采集没有 provider 与 snapshot 的细分账本。重复工作是源码与调用计数证实的问题，不能把原报告的全部差值归因于它，也不能仅凭消除调用次数认定性能门禁通过。

## 批次归属

私有交接以实际 preparation、request 和 sources 对象身份绑定，仅在当前 rebuild 生命周期内有效。交接内容只包含 rawCss、css、复制后的依赖与扫描规则、core 注册的不可变 snapshot，以及封存选项；不共享活动 compiler、PostCSS root、输出容器或跨批缓存。

独立快照仍创建自己的 compiler，沿现有路径转换 CSS、模板、JS 和组合本轮 sourcemap，并在收尾时 dispose 自身。两个真实 compiler 的相同输入契约覆盖 CSS、模板、JS、映射与双向失效、删除、重登记和 dispose 隔离。core 本身允许 target 和 projectRoot 不同的 snapshot 进入转换，因此框架必须显式核对全部有效输入。

## 准入与拒绝

首轮仅准入显式 CSS entries、普通主图、正常 generator 和默认 compiler。自动、导入、上下文入口、独立分包与 worker 保留原路径；原始 CSS 输入变化或配置无法封存时也不创建交接。

准入核对根集合及注册 token、完整选项、target、root id、有效 projectRoot/base、预处理 CSS 与依赖。初次与构建收尾重新解析实际扫描范围：所有匹配文件必须在 frozen Map 中具有字符串源码，缺失、未知和显式 null 不补读磁盘。模块解析登记的不存在后缀候选不属于实际扫描文件；实际编译消费的模块单独登记，即使随后删除也必须满足封存覆盖，不能按候选路径忽略。真实构建负例已复现这种先消费、后删除的窗口；native WXML 的带 query suffix 模块去 query 后仍进入 consumedSet，现有 gate 拒绝已删除且未封存的输入，无须新增生产修复或 observer。外部依赖同时核对封存字节与本轮文件版本，异步阶段前后重复验证归属和配置。

同 sources 的嵌套 build、多 preparation owner、已 dispose preparation、同 id 新登记及活动配置变化均拒绝。拒绝抛出原 CompilerHmrResyncError；Rolldown 包装 hook 异常时，只还原本轮准入记录且唯一的原异常，其他构建错误和多错误结果保持原样。批次继续使用原有完整重同步与失败恢复，不发布混合 generation。

## 生命周期与输出

preparation dispose 幂等撤销记录。rebuild 与 snapshot 的 finally 分别解除 sources 和 ctx 绑定；失败后下一轮及普通构建不能看到旧 view。不存在 compiler borrower，关闭快照不会关闭活动 provider。最终资产仍由 Vite/Rolldown emit/write 持久化。

回归覆盖四种映射模式的 fresh 输出逐字节对照和真实 original position、edit/restore、跨轮输出映射切换、原始 CSS 修改、扫描文件与外部依赖在准入前后变化、构建首错和后续恢复，以及根登记、配置和清理归属。既有 Tailwind、批次和独立快照测试同时保持原断言。

`tailwindcss.ts`、`hmr.ts` 和 `snapshotBuild.ts` 既有实现超过 300 行。本次把封存、比较、准入及归属管理放入私有 `tailwindcss/generation/` 模块，仅在原 prepare、generateBundle 和 rebuild 边界接入，避免扩大状态机重构。

## 验收边界

本轮相关回归 224/224、最终 boundary 失败恢复 7/7、包级 typecheck、13 个公开类型测试目录、范围 ESLint 和 dist 重建通过。新增 native WXML 负例同时验证被拒绝批次后的普通快照独立重新生成正确 CSS。重建后持有正式机器租约串行运行新的 snapshot 用例 1 个、原 #1081 用例 1 个和原 #1134 用例 3 个，严格 headless 验收为 5/5 cases、18/18 DOM checkpoints，failed、skipped、blocked、notExecuted 均为 0。新 snapshot 用例覆盖首次交互、非拓扑 JSON 编辑/还原及 JS utility 编辑/还原；原批次和失败恢复断言保持不变。

独立读回确认命令均成功退出、child scope 清理终结、机器租约已释放，执行前后 source/dist SHA 与当前文件一致。这仅是聚焦的 workspace headless 回归，不代表全部系统资源或真实 Stable 已完成验收，也不替代全部模式、打包消费者和原固定性能门禁。正式验收绑定各自候选提交；旧 b936 的正式性能回退与 Stable 启动失败结论不能外推或改写。真实 Stable 与原固定性能门禁保持原版本、预算、样本、deadline 和断言，未完成的 issue 保持开放。
