# 新冻结语料的独立性能画像

## 与冻结 main 的回归基准

`regression.ts` 比较冻结 main 与当前完整根入口，分别执行五个核心操作与三条真实消费者链路。比较实现固定为 `739da6b848a47ac44cb567ce643b97ff79da9cc4`，原始锁文件 SHA-256 为 `045a5e5768c86c98bf1220bd469091d518cd07c1e85bc3de0c3b87bbc487c99c`。它与旧 464 份 corpus 自身的冻结 ref 分别记录，不能相互代替。

先用精确提交冻结完整源码。工具批量读取 Git blob 并重放原归档字节，不执行来源仓库脚本；不可变 corpus 归档独立核对，因此不重复复制到实现快照。输出目录及其同级 `baseline-source-identity.json` 必须尚不存在。

```sh
node --import tsx scripts/templateCorpus/benchmark/regressionFreeze.ts \
  --ref 739da6b848a47ac44cb567ce643b97ff79da9cc4 \
  --output .tmp/current-run/template-decoupling/baseline-source
```

用冻结源码自身的配置准备并构建 baseline，再构建当前包。runner 不安装依赖、不构建产品。冻结源码的全部文件、原锁和 manifest SHA 必须符合 `regression-policy.json`；当前源码、HEAD、完整生产模块与当前锁单独记录和前后复核，允许候选因真实依赖边调整而修改锁文件。冻结 consumer 的 workspace 依赖显式指向冻结源码，不通过当前 `node_modules` 软链接引入候选实现。

```sh
node --stack-size=4096 --import tsx scripts/templateCorpus/benchmark/regression.ts \
  --baseline-entry .tmp/current-run/template-decoupling/baseline-source/packages/wxml/dist/index.mjs \
  --baseline-source .tmp/current-run/template-decoupling/baseline-source \
  --baseline-identity .tmp/current-run/template-decoupling/baseline-source-identity.json \
  --current-entry packages/wxml/dist/index.mjs \
  --core-entry packages/wxml/dist/core/index.mjs \
  --runtime both --check \
  --output .tmp/current-run/template-decoupling/regression-001
```

正式 `--check` 要求 Node 与 headless Chromium、完整分组、10 次预热和 40 对交替样本，共同校准批量。完整聚合组 `old464/shared`、`old464/real-all`、`all-platform/real-all`、`all-platform/controlled-all` 及 `/all` 组 P50 比值上限为 1.03，其余合法平台、方言、尺寸、特征和框架组上限为 1.05。越线只执行一次等量确认，持续越线为 `regression`，结论冲突为 `unstable`。缺操作、缺组、缺样本、工作量或顺序变化、产物替换、未解决输入以及伪造统计均阻止通过。

### 快速诊断与正式验收

`bench:regression` 默认带 `--quick`，以 5 对样本、2 次预热执行 `old464/shared`、`all-platform/shared-xml/all`、`all-platform/platform-specific/all` 三个代表组及五个核心操作；默认不运行三入口研究。它用于分钟级定位，不承诺固定耗时，也不能证明正式门槛通过。仍需传入上述冻结 baseline/current/source/identity/output 参数。`--group`、`--operations`、`--rounds`、`--warmup` 可以覆盖快速默认；显式 `--core-profile` 才增加所选输入的三入口研究。

`bench:regression:check` 保持完整正式验收：全部分类、两个运行时、10 次预热、40 对样本和必要的同量确认。`--check` 拒绝 `--quick`、筛选和继续收集失败的例外。旧 `bench:check` 与 htmlparser2 的独立验收入口、464 份语料及历史证据保持原协议。

### 精确重复工作量协议 v2

回归 runner 使用显式 `exact-workload-v2` 协议。相同运行、运行时、baseline/current 完整闭包与锁、操作、比较/信息模式、门槛、冻结配置及**有序 fixture 身份完全相同**的分类，只执行一次物理测量；代表任务固定为原顺序中的首次出现，不根据速度或通过结果选择。实际源码独立计算 SHA-256，完整 options 与 scan 使用的 profile 元数据参与身份；无明确冻结实现身份的 resolver 函数拒绝复用，不以普通 JSON 静默省略。

当前完整计划仍保留 157 个分组、845 个分类结论，对应 603 个物理任务，避免 242 次重复测量。每个任务仍完整执行原来的 10/40 预算、共同校准与同量确认；不同 1.03/1.05 门槛不合并。输入分母及分类门槛不变。实际去重数量由本轮外部计划重建，报告同时列出完整分类数量、物理任务数、避免的任务和真实样本数量。

原始 samples、warmup 和 calibration 仅由物理 `job` 保存一次；分类通过 `reference` 引用 job ID 与原始证据 SHA-256，分别重算该分类统计和门槛结果。两者不是独立重复样本。完整正式 primary arm 样本由 67,600 次物理执行变为 48,240 次，845 个分类各自仍引用 40 对成对观察；报告不会将引用复制为新测量来虚增样本数。

协议不跨运行、运行时、API 入口、操作、输入顺序或不同配置复用，也不拼接重叠分组的逐文档耗时。旧 v1 数据继续按每格独立测量读取和验证；缺少显式 v2 协议、混合记录、孤立/篡改引用、重复物理任务和复制到别名分类的 raw 样本均拒绝。旧结果保持原样；v2 实现与轻量验证不代表新正式采样已经通过。

默认在首个已确认的 `regression`、`unstable` 或 `incomplete` 格停止：先将该格所有样本、确认结果和 summary 写盘并同步，再记录 `firstFailure` 的完整结论及 checkpoint 尾哈希，返回非零。Node 失败时不启动 Chromium 或三入口研究；报告列出各运行时已完成、未执行的格数。成功的正式运行仍须完成全部矩阵、三入口研究和身份完整性检查。只有诊断可显式传 `--keep-going` 收集后续失败；`--check` 拒绝该参数及任何分组、操作筛选，不能用部分矩阵获得正式通过。

旧二十组保留 `old464/` 名称前缀，分别运行 scan、parse、canonical、实际编辑后 serialize、preserve no-op，以及真实构建 scanner、Web compiler、simulator 三条生产链路。全平台真实语料和受控产物保留 `all-platform/` 独立分母，使用冻结配置运行五个核心操作。所有合法平台输入均与 main 比较，不用 htmlparser2 的公共子集排除 WXML 语法。新语料不会被送入没有承诺支持其方言的 Web 或微信 simulator 消费者；`preserve-noop` 只作信息展示，不参与速度门槛。

完整运行另生成 `core-entry-profile/report.json`，对三个真实 built 入口分别报告模块、初始化、首次完整 corpus 遍历、内存和独立浏览器包体积：冻结 main 根入口、当前根入口、当前 `/core`。信息研究固定为三轮冷样本和一轮预热，scan 与 parse 使用独立新 Node 子进程或 Chromium 页面。只有当前 `/core` 的初始化包括 `compileDialect` 与 `createParser`；两个根入口的 initialization 只计 benchmark adapter 绑定，其真实 preset 成本仍计入模块加载或首次调用。绑定后的当前 root/core 使用同样的显式 profile 执行 scan/parse，并在计时外核对完整 tokens、诊断和树元数据。

浏览器 `moduleMs` 只计脚本执行，另列包含解析、编译及 IPC 的 `injectionMs`。Node 进程 RSS 与 Chromium CDP heap 分开报告；阶段快照和进程峰值不能解释为保留分配量。三入口研究只提供信息，不能用 `/core` 的收益替代完整根入口、真实消费者或原 htmlparser2 门禁；研究缺样同样阻止本轮验收完整。

`report.json` 保存冻结源码、当前源码、两侧锁、built 入口与全部传递 chunk、真实消费者闭包、策略、manifest、校准、预热、正式与确认原始样本、完整 operation parity 及每组状态；`report.md` 只作审阅视图。可以省略 `--check`，结合 `--runtime`、`--rounds`、`--warmup`、重复 `--group` 及 `--operations scan,parse` 做定位；操作参数也可重复。空、重复、未知选择及无交集的格子会拒绝运行。诊断保留完整来源身份和原始 inventory，但仅将所选格子的 fixture 并集传给 preflight、首次遍历和采样，不解析未选中的输入。分组或操作筛选默认跳过三入口研究；加 `--core-profile` 才对所选输入及其冻结 profile 配置执行这项研究。报告同时列出完整及实际选择的 fixture/group/cell 数量，局部或缩短采样不会标记正式通过。旧 `bench`、`bench:check`、464 份分母、二十组及历史结果保持不变。

两侧每个操作在计时外绑定实际 built export，scan 使用同一消费循环；每次计时批量内直接调用已选 runner。绑定简化不删减 parser 默认元数据、根入口预设或兼容文档成本，也不能解释为已修复观察到的产品性能回退。

回归入口显式启用每格完成日志，输出 operation、group、status 和已完成/总 cell 数。Node 直接输出，Chromium 转发专用前缀消息；日志发生在该格所有计时与统计之后，不进入 token、解析或批量热循环。旧画像与旧 benchmark 默认不输出这类进度。

原始证据逐格写入 `node-cells.ndjson` 与 `chromium-cells.ndjson`。v1 `cell` 保留旧独立采样结构；v2 `job` 只保存该物理任务新增的预热、正式、确认、校准、parity、错误和 summary，`reference` 仅保存分类结论与已落盘 job 哈希。每行附连续序号与 SHA-256 哈希链，不逐格重写历史结果。Node 等待写入并同步到磁盘，Chromium 在页内通过绑定等待同一写盘确认，之后才开始下一格。回调、RPC、JSON 编码与文件操作均位于计时外。最终验收从冻结输入重建全部逻辑分类和精确物理任务，逐行校验顺序、哈希链与外部 workload，并将落盘原始数据与最终结果逐项对照；报告引用证据文件哈希。

对应的 `node-checkpoint.json`、`chromium-checkpoint.json` 是小状态索引，记录最后完成格和文件尾哈希。正常 `SIGINT` / `SIGTERM` 在格间保留证据，主报告和索引标记 `interrupted`，退出码分别为 130 / 143；这种运行不能验收。进程崩溃或强制终止时保留最后已确认格，旧 `running` 状态也不能视为通过。尚未完成的当前格不拼接、不补造样本，后续正式重跑使用新的输出目录。

主报告先完整写入 `report.json.next` 并同步，再原子替换 `report.json`；写入、序列化或替换失败不会截断上一份完整报告。信号处理器保留到最后保存结束，保存期间到达的中断也会重新记录。最终大报告仍无法保存时返回非零，尽力写入独立的 `report-save-error.json`，保留原报告与逐格 NDJSON；错误证据也无法写入时同时输出两次失败。残留 `.next` 不能用于验收。

## 与 htmlparser2 的独立画像

该入口读取全平台 corpus 的独立版本，不修改旧 464 份性能语料、分母、历史结果或 `@weapp-vite/wxml bench:check`。画像完整只表示请求的样本与正确性检查完整，不能证明旧正式门禁通过，也不以新语料的比例替代原门槛。

先构建被测包，并确保没有构建、覆盖率、其他性能采样或 E2E 同时运行：

```sh
pnpm --filter @weapp-vite/wxml build
node --stack-size=4096 --import tsx scripts/templateCorpus/benchmark/index.ts --runtime both --corpus packages/wxml/test/corpus --output .tmp/template-corpus/performance-profile/run-001
```

每次运行必须使用尚不存在的唯一 `--output` 路径。入口原子预留目录；即使既有目录为空，也拒绝覆盖。失败重采选择新的运行路径，原报告、失败和全部样本保持可追溯。

默认 Node 与一个后台 headless Chromium 会话顺序执行。入口复用仓库机器级 E2E lease；Chromium 复用同一页面，并确认 headless、跨源隔离与固定 V8 stack budget，结束后释放自己创建的页面、context 和 browser。`--runtime node`、`--runtime chromium` 可以分别执行。`--entry` 可指定另一份已构建的公开入口，工具不自动构建产品包。

默认预热 10 轮、正式 40 轮。公共 XML 每轮交替 baseline/candidate 顺序，复用旧 runner 的共同批量校准、P50/P95、吞吐统计，保存全部 calibration probes 与正式 samples。`--rounds`、`--warmup` 可用于调试，报告明确标记是否使用正式预算。`--group` 可重复指定完整 group ID，报告保留选择范围，不把局部运行称作全量。

按内容/profile 去重计时，同时保留每个平台、框架版本、方言、尺寸及语法特征的交叉成员。尺寸分别为 `≤1 KiB`、`≤10 KiB`、`>10 KiB`。无效与待调查预期另列，不能根据新 parser 是否成功重新分类。公共 XML 用独立固定词法契约预先选择；平台特有、重复属性、绑定和原文脚本等独立报告 candidate 吞吐，没有 htmlparser2 速度比。

受控 MPX/Taro 矩阵产物从清单签名的 CAS 读取，完整核对 generation、源码哈希与 profile 后独立计时。它们保留 `quotaEligible: false` 和全部目标、模式、路径身份，分组使用 `controlled-fixture/` 前缀；真实来源全局数量与原有 `shared-xml/all`、`platform-specific/all` 分母不受影响。相同内容/profile 可在两种来源类别各计时一次。静态 expected 输出通过冻结来源配置的显式 recipe，完整匹配仓库、提交、原路径、平台、profile、snapshot 格式、key 和 section 白名单后归属框架版本；缺失或冲突身份单列 `expected:unknown`，不根据文件名猜测。

矩阵产物的显式冻结 `invalid` / `pending` 分类同样排除出所有计时组，报告独立保存合法、无效、待调查数量及每份排除记录的完整 generation、path、profile、原文、诊断和证据。没有显式分类的旧矩阵仍按合法契约验收；不会根据被测 parser 的运行结果反向分类。

操作包括完整 scan、parse 和 canonical serialize。scan 两侧收集相同的 opening tag 名与解码属性；candidate 的完整默认 tokens、位置和诊断成本均计时。parse 每次生成完整默认 AST。canonical 两侧都遍历已在计时外建立的树并实际编码；原文直接返回、缓存命中和 preserve no-op 不参与此画像。

输入读取、哈希校验、语料契约、公共 XML 差分、canonical 语义检查和测试宿主 bundling 全部在计时外。Node、浏览器使用同一套 built API 与计时模块，浏览器无每操作 Playwright RPC。所有实际 bundle inputs、built 入口、baseline、锁文件和 corpus manifest 在采样后重新核对身份。测试宿主的 bundling 只准备入口传输，不修改被测产品。

Node 测试宿主也完整打包实际依赖，包含 htmlparser2、domhandler、entities、dom-serializer 及其传递模块；metafile 中每个执行模块的字节身份均记录和复核，Node-only 运行不依赖浏览器 bundling 补充依赖清单。

`report.json` 保留来源身份、fixture/group inventory、全部原始样本、P50/P95、吞吐、比例、校准、首遍 corpus 操作时间、模块加载信息、Node 内存快照和浏览器包体积。首遍操作共享一个已加载 runtime，不能解释为冷进程或独立首次 import；浏览器代码注入时间包含 IPC，另行标注。Node 内存为整个进程快照，浏览器 heap 不可用时明确为 null，不伪称每操作分配量或峰值。`report.md` 便于浏览结果。

任何正确性失败、测量错误、缺少样本或计时器分辨率不足都会保留原失败并标记 incomplete/failed，入口返回非零。新画像不执行速度阈值判断；产品实现变化后仍须另跑原来的 Node/Chromium 正式 `bench:check`。
