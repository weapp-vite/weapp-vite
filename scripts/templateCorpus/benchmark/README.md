# 新冻结语料的独立性能画像

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
