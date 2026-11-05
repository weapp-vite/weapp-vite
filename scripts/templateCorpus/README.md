# 全平台模板语料维护

本目录维护 `@weapp-vite/wxml` 的冻结来源、编译矩阵和严格验收工具。包名与公开 API 不随语料平台扩展而变化。“完整采集”指选定提交内、登记选区中的合格模板，不表示穷尽公开互联网、私有项目或所有可能的程序输入。

当前结果以冻结语料的 `manifest.json`、离线清单和各项验收报告为准。工具已经实现，不代表语料数量、框架矩阵、解析、覆盖率或性能已经全部验收通过。任何缺口都应保留在报告中。

**平台解耦前的语料检查点：整体未完成。** `all-platform-v1` 已冻结 13,558 份真实内容去重模板、26,228 个来源成员、7,075 份具有真实非微信来源的唯一模板，以及 250 个实际拥有模板来源的独立公开上游。元数据中的 269 个 repo@commit、264 个独立身份还包含仅提供输入或证据的来源，不能替代真实模板上游配额。

Node 与 headless Chromium 的完整语料各通过 14,584 个用例；各自的正式固定种子运行完成 100,000 个合法组合、100,000 个明确非法变异及 10,000 条八步编辑序列。源码覆盖率检查 24 个生产文件，无 coverage-ignore：语句 1,172/1,172、函数 128/128、行 1,139/1,139 均为 100%，分支 1,164/1,171（99.40%）。该历史检查点的 464 份正式 v5 性能复验在 Node、Chromium 各通过 140 个速度门禁单元，无错误。新语料独立画像覆盖全部 135 组，在两个环境各完成 10 对预热、40 对正式采样、405 个汇总单元和 22,080 条正式样本；画像完成不表示新增速度门槛通过，不改写旧 464 份门禁的分母。历史失败、等量确认和后续通过报告分别保留。

源码覆盖率、解析与 fuzz 的通过只描述各自验收范围。Taro 4.3.2 Harmony JSUI 开发、生产两个格子仍失败，旧 MPX 原始 1,302 字节安装日志附件缺失，框架矩阵及整体验收仍未通过。完整清单、逐平台数量、独立报告和原始字节身份见[冻结语料与验收状态](../../packages/wxml/test/corpus/README.md)。

## 固定门槛

| 平台 | 原生模板扩展名 | 最少真实去重模板 |
| --- | --- | ---: |
| 微信 | `.wxml` | 500 |
| 支付宝 | `.axml` | 500 |
| 百度 | `.swan` | 500 |
| 抖音 | `.ttml` | 500 |
| 京东 | `.jxml` | 500 |
| 小红书 | `.xhsml` | 500 |
| QQ | `.qml` | 100 |
| 快手 | `.ksml` | 100 |
| 涂鸦 | `.tyml` | 100 |

全局还需至少 10,000 份内容去重模板、200 个独立公开上游仓库，以及 5,000 份有真实非微信来源的去重模板。同一内容按 SHA-256 只保存一次，保留全部来源；平台成员、类别成员和来源数量可以相交，不能相加得到全局唯一数。

淘宝、钉钉、飞书/Lark、快应用、360 和鸿蒙属于额外登记目标。格式、脚本标签和构建支持状态须分别由固定官方工具链证实。静态配置中存在 target 只能证明候选格式，不能代替实际构建。`.ux` 只提取显式模板区域；脚本、样式、ArkTS 不直接送入模板 parser。模板词法测试通过也不扩大 `weapp-vite` 的构建、上传和宿主 runtime 支持范围。

## 文件与命令

默认语料目录为 `packages/wxml/test/corpus`；缓存和普通报告在 `.tmp/template-corpus`。这些路径均可通过命令参数覆盖。根目录的 `corpus:*` 命令负责维护；包内的 `test:*` 命令负责验收。

```sh
pnpm corpus:discover --queries maintenance/queries.json --reports .tmp/template-corpus/discovery
pnpm corpus:collect --sources maintenance/sources.json --discovery .tmp/template-corpus/discovery/discovery.json
pnpm corpus:check
pnpm --filter @weapp-vite/wxml build
pnpm --filter @weapp-vite/wxml test:acceptance
pnpm --filter @weapp-vite/wxml test:coverage
```

`maintenance/queries.json`、`maintenance/sources.json` 是示例参数位置，维护者须传入本次审核后的实际文件。`corpus:collect` 完成归档后仍可能报告数量不足；只有后续检查全部通过才能验收。`corpus:check` 检查数量、来源完整性与框架矩阵；实际 parser 契约还必须运行 `test:acceptance` 和 `test:coverage`。

普通测试离线读取入库分片与证据，不发起 GitHub 搜索或临时下载语料。采集和框架依赖安装只在显式维护流程执行。验证依赖公开包入口时先重建包；修改生产源码后必须重建，再进行下一轮下游验收。

## 发现与来源审核

查询文件是 `{ "query": "...", "pages": 3 }` 的数组。每页记录查询、页码、总结果数、`incompleteResults`、仓库列表和预算截断状态。GitHub 搜索最多返回 1,000 个结果；达到上限、预算耗尽或服务器标记不完整时保留截断事实，需要拆分查询后继续发现，不能把搜索首页当成完整覆盖。

搜索仅产生候选。正式来源必须固定 40 位提交 SHA，随后完整遍历该提交的文件树。递归树响应截断时逐目录展开；目录树仍截断则失败。子模块内容属于另一个仓库，必须独立登记来源，不能把当前树中的 gitlink 视作已采集内容。

每个 `CorpusSource` 明确登记仓库、commit、许可文件、平台、profile、扩展名、include/exclude 和真实存在的配置证据路径。平台身份不能由 `.axml`、`.ttml` 等后缀单独决定：

- 优先使用平台专用 project 配置、编译目标、原有目标目录、README 平台说明及小程序成对文件。
- `.axml` 区分支付宝、淘宝和钉钉；`.ttml` 区分抖音和飞书。多目标工程缺少目录或配置归属时保留未确认候选。
- `.qml` 必须排除 Qt QML；`.ksml`、`.tyml` 必须排除同名语言和配置格式。
- 明确工程身份下的空模板、纯注释和纯文本仍是模板；QQ、快手、涂鸦等歧义后缀另检查小程序 sidecar。
- 身份无法确认的文件记录 repository、commit、path、platform、profile 和原因，不计入合格数量。不能运行候选 parser 后，按是否报错决定收录或平台。

GitHub 的 `fork: false` 不等于独立上游。镜像、教程整仓复制、同一项目拆出的 npm/demo 仓库应通过 `independentRepository` 收敛身份。比较 README 与模板哈希集合，同时保留正常依赖复用的业务项目身份；不能仅因两个应用都使用相同组件库就认定其互为镜像。

## 许可与采集恢复

只有确认许可且保存了许可正文的来源可以分发、计数。未确认许可的仓库只保留发现元数据。自动收集标准 LICENSE、LICENCE、COPYING、NOTICE 及常见文本/许可变体；非标准归属声明须在来源配方中显式补充，不能把 `notice.png`、`notice-bar.vue` 等资源当成许可。

模板使用最近祖先目录中的真实授权正文，记录 `licensePath` 和实际 `licenseSpdx`。`node_modules` 或 `vendor` 内的许可不能授权祖先代码；最近目录的 LICENSE 如果只有 `From:`、博客链接或未知内容，会阻断根目录许可继承。GitHub 的仓库 SPDX 标签、单独的 MIT 标题或来源 URL 不能代替实际授权。读取完整许可清单，不能按数组前几项判断是否缺少根许可。

每次 raw 下载核对 Git blob SHA-1；模板的 UTF-8 解码保留 BOM、Unicode 和 CRLF，再记录模板 SHA-256。非 UTF-8 许可保留为 base64、原始字节数和原始 SHA-256，不删除、不用替换字符修补，也不擅自猜测字符集。维护者阅读确认后可在 `license.encodings` 显式登记字符集，生成额外阅读视图；原字节仍独立校验，只有来源链接的内容仍不产生授权。来源证据文本、许可文件和每个压缩分片都另有哈希。符号链接不作为模板正文处理。

缓存按不可变请求存储字节及回执。每个完成仓库原子提交一个检查点；失败后复用同一缓存和配方续行。检查点身份包括 collector schema、来源与解析 profiles，校验规则变动时提升 schema，避免旧结果跳过新检查。429、403、网络错误和 HTTP 5xx 进行有限指数重试；持续失败保留最终状态与具体源路径，不回退到其他内容或未冻结分支。

## 原生、上游预期和实际编译产物

真实来源分别记录 `native`、`expected`、`generated`：原生文件、静态提取的上游预期输出、受控工程实际编译输出。静态快照通过 AST 提取字面量，不执行采集仓库的测试文件或构建脚本。动态快照表达式和无法确认的边界须保留未提取记录。

固定框架版本如下：

| 框架 | 版本 |
| --- | --- |
| uni-app Vue2 | `2.0.2-5030320261023001` |
| uni-app Vue3 | `3.0.0-5030420261029002` |
| MPX | `2.11.2`、`2.8.64` |
| Taro | `4.3.2`、`3.6.40`、`2.2.22` |

`frameworks.json` 登记各版本的全部标记模板候选目标。每格分别记录 development、production 的 `built`、有上游明确证据的 `unsupported`、`pending` 或 `failed`。缺格、待解决、构建失败或无证据的“不支持”均不能通过。框架本来不支持的平台不要求伪造产物。

```sh
pnpm corpus:generate --matrix
pnpm corpus:generate --freeze-input maintenance/input-recipe.json --cache-dir .tmp/template-corpus/cache --output-dir .tmp/template-corpus/input
pnpm corpus:generate --framework uni-vue3 --version 3.0.0-5030420261029002 --target mp-alipay --workspace .tmp/template-corpus/generated --input .tmp/template-corpus/input/source --identity .tmp/template-corpus/input/identity.json --execute
```

上例的 input 和 identity 路径须使用冻结工具实际返回的文件。生成器仅运行自己创建、固定依赖的受控配置，安装使用 `--ignore-scripts`；不执行随机上游 package scripts。真实输入、编译器、锁文件、配置、命令、运行环境、输出哈希和日志分别保存。失败后显式 `--retry` 才新增尝试，历史失败保留；成功结果只有哈希仍一致时才可复用。

自产语法夹具可以验证框架能力，但不具有真实上游模板身份。此类输入必须传 `--fixture-id`，输出保存为 `matrix-templates.jsonl`，带 `quotaEligible: false`，不得并入真实语料数量。禁止改扩展名、替换指令或复制微信模板来制造其他平台真实来源。

## 冻结证据

`writeCorpusEvidence` 仅冻结调用方显式挑选的资源。将完整 tree、选区配方、发现原始报告、受控输入、配置、锁文件、日志、非模板输出和原始报告压成确定性 gzip，返回的 identity 放入 `manifest.evidence`。共用内容按 `objects/<SHA-256>` 只冻结一次；输出模板已在内容分片，不再重复归档。不得放入 `node_modules` 或编译器 bundle。

每个来源的 `evidence` 引用 `sources/<repository>/<commit>/references.json`，每个构建格子引用 `generations/<id>/references.json`。这些引用记录使用未压缩原文身份；`manifest.evidence` 使用压缩文件身份。归档写入和离线读取都检查完整映射，缺少树、配方、原始报告、历史尝试或声明文件会失败。普通原生模板另核对冻结 Git blob SHA-1；`.ux` 必须冻结完整容器正文，独立提取并核对模板原文与 UTF-16 范围。

真实框架产物的输入同样绑定源树：`NativeEvidenceSource.configuration` 可以直接使用完整 `input-metadata.json`；同仓库多份输入可放在 `{source, inputMetadata: [完整元数据, ...]}`。迁移早期受控输入时使用显式 `{source, inputProjections: [{id, files: [{sourcePath, destination, gitSha, sha256, bytes}]}]}`；原路径来自冻结 source tree，destination 对应原构建 report.input 的 file。每份构建输入必须完整匹配其中一个投影，CAS 原字节再核对 Git blob 与许可，不能只更新自声明 SHA-256。旧构建无需重跑，只需冻结经过审核的完整映射。自产矩阵夹具另按全部输入文件内容重算 fixtureId，不能充当真实上游来源。

导入已有采集结果时使用 `--collection <collection.json>`，同时通过 `--source-evidence <evidence.json>` 提供 `NativeEvidenceSource[]`：每项包含 repository、commit、完整 tree、实际 configuration，以及存在 `.ux` 时的 `containers: [{path,text,sha256}]`。缺失映射直接失败，不依赖在线重新猜测。直接传 `--sources` 会从同一缓存恢复这些完整记录。维护报告保存完整 `collection.json` 和 exclusions，框架目录通过 `--generation` 导入并验证原文件。

静态预期产物使用 `corpus:generate --extract-expected` 生成的目录，通过 `--expected` 导入。`expected-source.json` 固定来源、原文件身份、格式和选中的 snapshot keys，`expected-extraction.json` 保留完整静态提取及拒绝记录。混合目标文件按重复的 `--snapshot-key` 选择实际属于该平台的 key。入库时同时提供上游完整 tree/配方；`NativeEvidenceSource.snapshots` 冻结 `{path,text,sha256,format}`，离线重新静态提取并核对 origin 的 key、格式和 UTF-16 范围，不把整个 snapshot 文件直接送入 parser。

完整 exclusions、原始 discovery、分类审核与宿主证据通过可重复的 `--evidence <manifest.json>` 显式冻结。manifest 是 `{file, kind, path}` 数组，例如 `[{"file":"maintenance/classification.json","kind":"report","path":"classification.json"}]`。path 必须相对该 manifest 目录，且为普通非符号链接证据文件；不扫描 `.tmp`，不跟随 `node_modules`，不读取可执行源码。支持 JSON/JSONL、Markdown、纯文本、日志、YAML、CSV、PNG/JPEG/WebP 与 PDF。file 是稳定来源标签，不能占用 objects/sources/generations/additional/evidence 协议前缀；同名异文、角色冲突、大小写或 Unicode 归一化冲突均失败。原字节按 CAS 去重，`manifest.additionalEvidence` 绑定完整 `additional/references.json` 映射，离线逐项检查哈希与大小。

证据索引同时记录压缩字节和原始字节的数量与 SHA-256。`readCorpusArchive` 校验所有证据路径、文件哈希、长度和索引，阻止文件替换、遗漏及大小写同名覆盖。构建日志在冻结前把临时工作目录和本机路径替换为稳定占位符，保留运行状态、命令、版本和错误。

重新生成归档只清理上一份 manifest 明确拥有、且原始 hash 与大小仍一致的退役分片和证据；未登记文件、被修改文件和符号链接不会被当作垃圾删除。

## 正确性与覆盖率

同一内容的不同 profile、预期类别都必须执行。合法、明确无效、待调查的分类由上游用途与独立证据确定，不能根据本次 parser 输出反向调整。合法输入必须全部通过；无效输入必须命中登记的诊断码并拒绝不安全编辑/序列化；待调查输入阻止验收。

每个 profile 固定 `syntax`、`rawTags` 和 resolver 配置。遇到失败不自动换方言。`jds`、`qs`、`import-sjs`、百度 filter/SJS 以及各平台脚本模块按真实配置保留原文；普通自定义组件不能全局视作脚本。默认边界解析与 `resolveScriptBoundary` 辅助解析结果分开报告。

全量语料检查 scan/parse 一致、tokens 源码分区、UTF-16 半开范围、标签配对、属性顺序/重复项、preserve 逐字往返、canonical 语义与幂等、walk、编辑后重解析。公共 XML 子集与 htmlparser2 差分；平台语法由上游预期、实际编译输出及必要宿主证据判断。每个平台的指令、事件、模板引用、实体、引号、换行、插值、错误和编辑生命周期都有独立场景统计。

正式固定种子预算至少 100,000 个合法组合、100,000 个有明确预期的非法变异、10,000 条八步编辑序列；覆盖全部登记 profiles。保留种子、原失败、缩减结果和编辑步骤。小预算调试结果不作为正式验收通过。

`test:acceptance` 使用 `verify.ts --suite all`，默认依次验收根入口与 `/core`，每个入口在 Node 和 headless Chromium 中都执行完整语料及完整正式 fuzz 预算。它把原先独立运行的 `test:corpus`、`test:fuzz` 合在同一轮冻结身份内，Node 验收从四段合为两段，Chromium 从四次启动减为两次；每个 case、profile 和随机预算的执行次数保持不变。CI 使用该组合入口，两个独立命令继续用于定向排障。

`/core` 从冻结 profile 显式编译方言，不从根入口取得默认平台配置；测试消费视图与真实核心 AST 分开保存，编辑仍使用原文档上下文。定向排查可以传 `--api-variant root` 或 `--api-variant core`，单入口结果会标记 `completeVariants: false`，不能代替双入口整体验收。

生产源码的语句、函数、行覆盖率要求 100%，分支要求至少 99%。按原始命中数判定，检查生产文件清单完整性，输出逐文件缺口。不得添加 coverage-ignore、排除复杂模块或删除防御逻辑来抬高数字。

正式 `test:coverage` 另外写出 `coverage/run-receipt.json`。它绑定本轮唯一 `runId`、起止时间、测试进程退出码、最终清单原字节与内容哈希、全部生产源码、built 入口及完整 dist 模块、测试与公开类型测试及共享断言、测试配置和依赖锁。生产文件清单继续使用同一覆盖率分母；其余身份只证明执行输入，不加入分母。执行前后重新计算这些身份，变化直接失败。转发入口背后的共享 chunk 也必须保持相同身份。

收据的 `reports` 保存 `coverage-final.json`、`source-corpus-root.json`、`source-corpus-core.json`、`source-fuzz-root.json`、`source-fuzz-core.json` 和 `strict-verdict.json` 的路径、原始字节数及 SHA-256。四份源码验收报告携带相同 `runId`、完整 `identity` 和各自的 `apiVariant`；旧运行、独立运行、不同源码或另一入口的成功报告不能补作本轮证据。`strict-verdict` 保留原始覆盖数量与逐文件缺口，`coverageAccepted` 只表示整数覆盖门槛，最终 `accepted` 还要求测试退出码、四份完整源码验收及身份校验全部通过。报告中所有索引路径均为仓库相对路径。此前冻结的单入口报告原样保留。

源码覆盖率与 built 入口使用相同断言，两者分别验收，覆盖率不能替代 built 入口结果。Node 与 headless Chromium 都执行完整冻结语料；浏览器报告不能由 Node 覆盖率替代。`test:acceptance`、`test:corpus`、`test:fuzz` 在 `<suite>/<variant>/` 保存 `node-<variant>.json`、`chromium-<variant>.json` 与失败记录，整体 verdict 为 `verdict-<suite>-all.json`；组合入口的 suite 为 `all`。`test:coverage` 另输出原始覆盖率和严格 verdict，已经包含全部包内单测，不必在同一冻结输入下再重复执行 `test`。先构建的流水线使用 `test:types:check` 验证公开类型；`test:types` 保留独立使用时自动构建的行为。每个 built 报告包含入口及完整 dist 模块身份。正式采样、覆盖率、构建、仓库 E2E 按既有规则串行。

## 缺陷与交付

失败先保留原始输入和最小复现，再修复所属 parser、serializer 或消费者配置。涉及语言服务、构建扫描、Web、simulator 的修复同步补相关回归；涉及宿主语义时补 headless 与真实 IDE 对照，分别报告解析、构建与 runtime 的结论。

既有 464 份性能语料与历史结果保持独立。新语料另设版本，按平台、框架、尺寸和特征报告，不修改旧分母。核心变化后重建受影响包，再运行 `pnpm --filter @weapp-vite/wxml bench:check`：Node/Chromium 预热 10 对、正式 40 对；真实语料整套主操作中位耗时不得高于基线，单类耗时比不得超过 1.05。越线只接受一次等量确认，持续失败、冲突不稳定或缺样本都阻止验收。

新版本语料的独立画像入口见 [benchmark/README.md](./benchmark/README.md)。它按平台、框架版本、尺寸、方言与特征输出 scan/parse/完整 canonical 的 Node/Chromium 样本与吞吐，公共 XML 才比较 htmlparser2/dom-serializer。画像不改写旧门禁或历史结果。

`bench:regression` 默认带 `--quick`，用于快速定位回退；完整正式验收使用 `bench:regression:check`。快速诊断不替代完整性能预算或正式结论。

更新交付应包含分片、来源/许可/NOTICE、完整证据、框架矩阵、语法矩阵、失败记录、覆盖率和 Node/Chromium 报告。先运行相关 lint、typecheck、类型与回归门禁，再按主线规则提交和推送；本任务不自动发布版本。任一数量、来源、矩阵、正确性、覆盖率或性能门槛尚缺时，报告必须明确写“未完成”。
