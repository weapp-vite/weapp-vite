# WXML parser benchmark

该入口比较新鲜 built `@weapp-vite/wxml` 与当前锁文件中的 htmlparser2、dom-serializer。
首次在干净 checkout 复现时，先安装锁定依赖并执行 `pnpm build:pkgs`，生成消费者依赖的 workspace dist；之后源码变化仍需先重建受影响包。正式采样前先构建 WXML 包；消费者候选 adapter 在计时外打包为独立入口。

```sh
pnpm --filter @weapp-vite/wxml build
pnpm --filter @weapp-vite/wxml bench --output .tmp/current-run/wxml/exploratory
pnpm --filter @weapp-vite/wxml bench:check --output .tmp/current-run/wxml/formal
```

package 的默认命令在 Node 与 Chromium 分别运行八项操作：核心五项，以及迁移后的 scanner、Web、simulator 三个生产入口。正式迁移验收使用这一完整矩阵。底层 runner 的 consumer flags 可选，省略后仅运行核心五项，适合单独定位 core 问题；core-only 报告不能作为最终迁移验收。

`--quick` 仅用于定位问题，固定 1 次预热、3 对样本，不能作为性能验收；仍须通过语义和证据完整性检查。`--check` 固定 10 次预热、40 对交替串行样本。两种模式均先以一次基线校准计算 50 ms 目标的批次数，再探测可比较操作的候选批次；不足 0.1 ms 时扩大双方共同迭代数并重新探测，上限 10000 次。校准完成后双方所有 primary/confirmation 使用相同的固定迭代数；探测值、扩容过程和最终共同迭代数均保留。达到上限仍不足 0.1 ms 会记录 calibration failure，既不填充伪正数，也不假定候选已通过。所有样本保留。v4 对每项可比较主操作（四项核心操作及三个消费者）要求：shared 聚合与完整真实语料 real-all 聚合的候选/基线中位数比均不大于 1；尺寸、特征、WXML 分类及独立压力 cohort 均不大于 1.05。preserve-noop 始终单独提供信息。越线只允许一次等量确认，两批均越线为回退，结论冲突为不稳定，两者都不能通过。统计直接复用 `scripts/performanceGate/evaluate.ts`，偶数样本的中位数取中间两值的均值，并报告成对耗时增量。

同一机器不得与其他构建、E2E 或性能运行并行。输出目录必须不存在，失败不会覆盖先前证据。采样前后核对产物哈希。普通 wall 样本不安装 inspector、强制 GC 或分析钩子。进程内存快照包含 corpus、imports、AST 和报告对象，不代表某个 API 的 retained allocation 或瞬时峰值。

入口从 prepare 到 Node、cold、browser 及资源清理始终持有仓库共用的同机 E2E 租约，跨 worktree 也不能重叠。租约 busy 时保留失败报告，等待当前 owner 完成后重试；不创建隔离租约目录，也不清理其他任务的进程或资源。执行与租约释放同时失败时沿用现有 helper 的聚合错误，最终报告仍由外层 finally 写出。

Node 主进程、每个 cold child 和 Chromium 的 V8 栈预算固定为 4096 KiB，双方共用该预算；Node 未显式传入时入口直接失败。报告记录 Node 实际 `execArgv`、cold child 实际参数，以及 CDP 回读的 Chromium 命令行。深度 2048 的旧 serializer 在默认栈预算下可能于优化后栈溢出；原失败报告保留，既不删除压力输入，也不修改旧算法。任一 cell 的 preflight、warmup、calibration、primary 或 confirmation 异常均记录 operation/cohort/arm/phase 与具体输入，继续其余 cell，最后仍使验收失败。

冷路径使用每侧每个 cell 独立的新 Node 进程，不执行预热；分别保存模块 import 和第一次完整 corpus pass 耗时、进程 peak RSS。浏览器冷路径每侧每个 cell 新建页面，预先加载双方模块后执行首次 corpus pass；它测试解析器初始化，不代表浏览器进程或网络冷启动。正式冷路径同样采集 40 对，quick 只有一对。冷路径只报告，不参与选定的 warm 性能门槛，也不触发确认重采。preserve-noop 计时被浏览器时钟量化为 0 时原样保留，不填充伪正数；它同样不参与性能门槛。

冷路径也按外部 fixtures/cohorts、轮次、双方顺序和工作量验证完整性，并从原始样本重算全部 summary 与 Node import/peak RSS loading 统计。缺失整个 cohort、任一侧样本、重复、非有限值、负时长、伪造汇总或额外 confirmation 都使最终验收失败；Chromium 另逐页核对时钟和隔离响应。合法的零时长仍保留，派生比值或吞吐量按原统计规则报告，冷路径不增加速度门槛。

## 输入与比较边界

受版本控制的 `policy.json` 固定旧提交 `b6d0577164c8ccb3b2c0e5afff702c1997297550`、corpus 路径/扩展名/分组规则、464 个去重文档及整个清单哈希。`freeze.ts` 从该提交的 Git tree 读取 apps、templates、e2e-apps、mpcore demos 的全部原生模板，按内容 SHA-256 去重并保留全部来源；不会读取日后的 HEAD 作为旧基线。旧 scanner、Web parser 和 simulator 的 WXS/属性预处理完整入口及相关 workspace 源码从同一 Git 对象打包，外部依赖沿用本轮锁文件并记录版本。

当前 ignored 冻结目录为 `.tmp/current-run/wxml/baseline`。缺少目录时 benchmark 自动按照已审阅 policy 生成；已有不完整或不匹配目录时保留现场并失败，不自动覆盖。也可显式重放到一个新目录：

```sh
pnpm exec tsx scripts/benchmarkWxmlParser/freeze.ts --ref b6d0577164c8ccb3b2c0e5afff702c1997297550 --output .tmp/current-run/wxml/baseline-replay
```

旧 Git 对象必须存在于本地。改变提交、输入或 cohort 必须显式修改 policy 并重新审阅；不可因较慢或失败而删除输入或重选基线。

共享 XML 语法与原始 WXML 独有语法按源码特征预先分组，分组不依赖耗时或解析是否成功。WXS raw text、反斜杠引号和插值内部标签字符属于独有组，所有输入仍执行并报告错误/差异；旧解析器的错误行为不能作为新 parser 的正确性标准。WXML 的 baseline/candidate 原始投影及差异逐项完整保留，既不归一化，也不因速度门槛通过而宣称语义等价；正确性须另由 package/runtime suite 验证。shared 组的语义差异、压力输入的差异、preserve-noop 原文差异和任意操作异常均使正式验收失败。v4 的 WXML 分类速度门槛与这条正确性边界独立，语义差异不会豁免该分类的性能检查。

`policy.json` 另固定可重叠的特征 cohort：至少 8 个属性、插值、实体、脚本标签、Web 标签，以及 WXML 独有组内的脚本子组。脚本与 Web 标签白名单也由 policy 固定。新增压力输入分别测量深度 32/128/512/2048 的树、正文 1 KiB/16 KiB/256 KiB/1 MiB 的文本，每个输入保留独立 cohort。真实 shared corpus 没有实体样本，因此另固定 16/1024 个元素的实体输入，在 quoted 属性与文本中覆盖 XML 命名实体、十进制和十六进制字符引用；分别报告 `stress-entities-16/1024`。这些输入不加入原始 464 个文档，也不改变原始 shared 聚合的成员与权重。

v4 在全部旧 cohort 之后追加 `real-all`，按原始清单顺序包含全部 464 个非 synthetic 文档（shared 354 + WXML 110），保留输入内容、来源、哈希与原始分类。它是独立预热、校准及成对采样的完整 corpus pass，不把 shared/WXML 分组的 P50 相加或混合权重。冷路径同样追加该完整分类；原有 19 个分类与相对顺序保留，变为 20 个分类。每项操作与输入的语义 oracle 仍只记录一份结果，不为重叠 aggregate 重复制造 parity 条目。

计时前冻结 `wxml-paired-v4-full-real-wxml-gates` workload manifest，包含完整操作集合、输入哈希与字节数、cohort 成员、采样轮次、明确的聚合与分类速度门槛，以及实体、共同节点位置和原始文本编辑契约。Node 与 Chromium 必须满足同一份外部 manifest：核心五项加本次请求的每个消费者。结束后核对操作与 cohort 的笛卡尔积、每个输入的 parity、原始样本的双方顺序/轮次/迭代数/字节数，重新计算汇总；缺失整个操作、遗漏特征 cell、伪造通过汇总或额外确认均失败。real-all 必须位于末尾，成员与顺序精确覆盖全部非 synthetic 输入，字节数从输入清单重新求和；即使报告同时删除自带 manifest 与 samples 中的 real-all，也会失败。`inputs.json` 保存所有真实与生成输入描述，报告保留完整 manifest；候选 `src`、runner 源码、policy、显式 consumer entry、冻结 bundle、esbuild metafile 中全部实际输入（包括 workspace dist chunk 和第三方依赖）与输出 bundle 全部记录 repo-relative 哈希，并接受采样后的身份核对，包含尚未跟踪的新源码。

扫描双方收集相同的标签名和解码属性值；候选 scan 的全部 token/diagnostic 成本仍在计时内。parse 使用原文建树：候选保留 raw 属性和文本，htmlparser2 使用 XML 模式、`decodeEntities: false`、自闭合识别和首尾索引；Node cold 与浏览器 first parse 使用同一原文配置。parse 的计时外 oracle 比较 raw 属性首值、文本及 comment/CDATA/declaration 去外壳后的内容，另比较共同节点的 UTF-16 半开范围；旧侧 inclusive end 转为 end + 1。CDATA 只比较外壳节点，不把 domhandler 人工创建且缺少完整原文位置的内部 Text 当作双方共同节点。候选额外的属性词法位置、token 配对和诊断仍全部生成并计时，这些元数据没有宣称与旧树等量。

canonical 使用各自自然表示的预备树：候选 AST 保留原文实体，未编辑的文本及 XML 属性可复用已有词法编码；旧树启用实体解码，dom-serializer 再对实际值执行编码。比较的是两套 API 的实际输出语义，不是完全相同的内部实体编码工作，也不要求输出字节相同。该操作仍执行树遍历和标签／属性标点规范化，不等同于完整实体重编码。

parse-edit-serialize 每次新建自然表示的树，修改首个元素属性和首个原始源码非空文本；旧侧按 startIndex/endIndex + 1 读取原文后 trim，候选文本本身即为 raw。两侧跳过 CDATA 内部文本，保留 WXML raw-script 等语法本身的差异并报告。preserve-noop 单独报告，不用直接返回原文的成绩证明完整序列化同速。v2、v3 的报告、分类、阈值和结论保持历史原样。v4 保留 v3 的 raw 建树及原始源码编辑任务，只补强完整真实语料聚合与 WXML 分类速度门槛；必须用 v4 全部计划重新采样，不能回算旧 v3 样本、混用两版数据或回写旧报告。

`--browser` 启动并关闭一个独占的 headless Chromium context/page。warm 与每个 cold 页面都通过受控 HTTPS route 获得 `Cross-Origin-Opener-Policy: same-origin` 和 `Cross-Origin-Embedder-Policy: require-corp`，逐页核对实际响应头与 `crossOriginIsolated === true`，避免非隔离文档的粗粒度计时。Node/warm 页面及每个 cold browser 页面记录 `performance.now` 连续读取中观察到的最小正增量；没有观测到增量时记为 null。所有原始零时长保留。页内计时执行与 Node 相同的核心和所选消费者操作，不在计时内跨 Playwright RPC；cold 仍只覆盖核心首次解析。脚本注入耗时包含 IPC，只作信息展示；浏览器内存不可用时记为 null。报告同时保存 Node/依赖/浏览器版本、源码/产物哈希、原始样本、P50/P95、documents/s、MiB/s 和最小浏览器 bundle/gzip 大小。最小 core bundle 单独构建，不包含消费者或 Babel。

## 消费者 adapter

按需传入候选入口和导出名，旧侧始终来自冻结产物：

```sh
node --stack-size=4096 --import tsx scripts/benchmarkWxmlParser/index.ts --quick --consumer-scanner packages/weapp-vite/src/wxml/scan/tokenScanner.ts#parseWxmlTokens --output .tmp/current-run/wxml/scanner-exploratory
```

另支持 `--consumer-web <entry>#<export>`、`--consumer-simulator <entry>#<export>`。
所有 adapter 默认保留旧入口的 options/返回结构；消费者链路包括现有 masking、parse、转换、restore 的实际成本，不复制一份近似实现做基线。Web 测量直接调用 `parseWxml(source)`，不覆盖 plugin 的原生文件名方言选择、include 图或 legacy `createTemplate`。

浏览器侧直接打包同一份冻结 Node bundle 与候选 adapter，保持三个消费者及完整输入。scanner 原本属于 Node 生产入口，需收窄两个公共 barrel 的模块加载范围：language-service 的 AST barrel `parse` 导出直接解析到其真实 `dist/babel.mjs`；候选 scanner 的 `wevu/compiler` 内置组件导出直接解析到真实 `auto-import-components/builtin.ts` 及其生成组件表，与 freeze 的收窄路径一致。既有 compiler dist、package manifest、实际实现文件都记录身份。仅 Babel loader 和冻结 scanner 可加载有限的 `createRequire` 桥，桥返回本轮锁定的真实 `@babel/parser`，未知模块直接抛错，不替换业务解析语义。实际 Babel 版本、文件、桥和导出别名均记录在 `inputs.json` / identity 中。模块加载与懒加载成本不计入 warm 样本；这不代表生产 scanner 已成为浏览器公开入口。

准备后可通过 suite 导出的 `checkCorrectness(operations, fixtures, expectedOperations)` 完整执行无计时预检：每个原始文档和压力输入均执行双方入口及语义 oracle，保存所有异常、差异和失败结论，`samples` 恒为空。它不替代正式配对样本，也不修改原始 corpus 分类或门槛。

纯 runner 合约验证不会启动 benchmark 或浏览器：

```sh
pnpm exec vitest run --config scripts/vitest.config.mjs scripts/benchmarkWxmlParser --maxWorkers=1 --no-file-parallelism
pnpm exec eslint scripts/benchmarkWxmlParser
```
