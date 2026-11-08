# 全平台小程序模板冻结语料

语料版本 `all-platform-v1`，内容 SHA-256：`1fe0bf88acffcbb1972b9b91b2596ec073e678f5f6a5efb6d423a3bfb5e516fb`。

真实内容去重模板 **13,558**，来源成员 **26,228**，具有真实非微信来源的去重模板 **7,075**。实际拥有模板来源的独立公开上游 **250**；元数据另登记 269 个 repo@commit、264 个独立身份。后两者包含仅构建输入或预期输出证据来源，不能代替 200 个真实模板上游门槛。

| 平台 | 去重内容成员 | 来源成员 | 原生内容成员 | 上游预期成员 | 实际编译成员 |
| --- | ---: | ---: | ---: | ---: | ---: |
| alipay | 1,177 | 2,095 | 305 | 3 | 869 |
| harmony | 660 | 1,312 | 0 | 0 | 660 |
| jd | 787 | 1,443 | 121 | 4 | 662 |
| ks | 660 | 1,312 | 0 | 0 | 660 |
| lark | 660 | 1,312 | 0 | 0 | 660 |
| qq | 774 | 1,440 | 106 | 3 | 665 |
| quickapp | 1,094 | 3,936 | 0 | 0 | 1,094 |
| swan | 720 | 1,374 | 57 | 2 | 661 |
| tt | 685 | 1,330 | 31 | 3 | 651 |
| ty | 134 | 135 | 134 | 0 | 0 |
| weapp | 6,573 | 9,227 | 5,689 | 6 | 882 |
| xhs | 660 | 1,312 | 0 | 0 | 660 |

平台、类别与框架成员可以相交，不能相加得到全局唯一数量。自产编译矩阵夹具带 quotaEligible=false，单独冻结和测试，不计入上述真实数量。完整采集仅针对登记的固定提交及审核选区，不表示穷尽全网或所有可能输入。

模板解析不扩大 weapp-vite 的构建、上传或宿主 runtime 支持承诺。UX 只测试显式 template 区域；无模板的应用脚本容器明确排除并保留原产物证据，脚本、样式和 ArkTS 不直接送入 parser。

## 证据与许可

- manifest.json 绑定全部确定性 gzip 分片及证据索引；evidence/index.json.gz 同时记录原始字节身份。
- [SOURCES.md](./SOURCES.md) 与 sources/inventory.json.gz 登记来源、commit、平台和配置 CAS；每个模板来源保留原路径、分类、profile 与许可范围。
- [NOTICE](./NOTICE) 与 licenses/inventory.json.gz 登记全部许可正文、NOTICE、根/子目录授权范围及 3 份独立归属补充；licenses/objects/<SHA-256>.gz 保存逐字原文。补充归属只记录实际分发关系，不改原 licenseId、授权范围或数量。
- [维护说明](./maintenance/README.md) 说明配方恢复与显式更新；普通测试离线读取语料。未确认许可的发现候选不分发、不计数。

## 验收状态

**总体未完成。** 数量已由本冻结输入重算；解析、覆盖率、浏览器、消费者 runtime 与性能各有独立边界，不能由数量或探索性解析结果替代。

Taro 4.3.2 Harmony JSUI 的 development、production 两个候选目标已完成真实构建。当前 generation 为 `taro-4.3.2-harmony-jsui-3075bb2db3ec67a1-development`、`taro-4.3.2-harmony-jsui-3075bb2db3ec67a1-production`。旧失败 generation、原始报告、锁文件与日志继续保存在冻结证据中。受控配置包含固定版本与 SHA-256 校验的页面模块兼容层和资源源路径预载；官方包文件保持原样，模板及静态资源仍由官方编译与写出链路生成。

官方 Harmony runtime 的六项缺失导出诊断仍原样保留，本次只验证模板生成，不宣称 Harmony runtime 通过。

当前 manifest 原始字节 SHA-256：`f11a70e9dabdfaf18bf8453af1de0a1a7dab600514f001004b118e590e080c38`。本目录的解析、fuzz 与覆盖率报告保留了同一内容 SHA-256 的历史通过事实；这些报告绑定旧 manifest，未覆盖新增的 Harmony JSUI 矩阵产物。本轮矩阵与 CI 验证另存于任务证据。

历史 MPX 安装日志附件另有不可恢复缺口。

自产矩阵另有 12 份显式分类产物成员、6 份独立内容；明确无效 12，待调查 0。分类绑定 generationId/path/profileId/SHA-256，保留上游 codegen、原产物及最小复现证据；明确无效项执行诊断与拒绝编辑/序列化契约，不进入公共 XML 差分和性能合法输入。

| 验证范围 | 当前记录 |
| --- | --- |
| corpus/node | historical-unbound（历史通过，未绑定当前 manifest） |
| corpus/chromium | historical-unbound（历史通过，未绑定当前 manifest） |
| fuzz/node | historical-unbound（历史通过，未绑定当前 manifest） |
| fuzz/chromium | historical-unbound（历史通过，未绑定当前 manifest） |
| sourceCoverage | historical-unbound（历史通过，未绑定当前 manifest） |
| consumerScanner | passed |
| nativeScriptBuilds | passed |
| nativeScriptWatchers | passed |
| webConsumer | passed |
| simulatorNode | passed |
| simulatorBrowser | passed |
| headlessIde | passed |
| consumerBuilds | passed |
| stableDevtoolsIde | passed |
| webBrowser | passed |
| old464Performance | passed |
| corpusPerformanceProfile | profile-complete |

消费者与宿主结果来自 validation/consumer-runtime-receipt.json.gz 的独立证据索引：构建与原生模块/HMR 回归 361 项、原生脚本实际 Vite 构建 8 项、watch/lifecycle 回归 412 项、Web 107 项、Chromium Web 两个交互模板、simulator Node 进程 3 项、真实浏览器 1 项、provider-compatible headless 2 项及真实 Stable IDE 2 项分别登记原日志身份；六平台与 Web 构建另有 exitCode 汇总。未单独持久化进程退出码的 Vitest 日志只报告其完整通过摘要。真实 IDE 记录官方查询、实际连接版本和基础库；这些局部夹具结果不表示全量语料在宿主中执行，也不声称绑定后来仅修订来源证据的 manifest。

- framework cell taro-4.3.2-harmony-jsui-3075bb2db3ec67a1-development: built
- framework cell taro-4.3.2-harmony-jsui-3075bb2db3ec67a1-production: built
- 历史 MPX 2.8.64 首轮安装日志原始 1302 字节附件缺失；原报告 SHA-256 和现存 1412 字节日志分别保留，未替换原身份。

本目录 delivery-status.json.gz 仅登记冻结状态与可见报告身份，不宣称最终验收通过。既有 464 份性能语料与历史结果保持独立；新语料版本不改写旧分母。

validation/reports 保存 Node、Chromium、source 和原始命中数量报告的可分发副本，仅用稳定占位符替换本机路径；原报告 SHA-256、原始字节数和运行身份另存于交付状态及覆盖率收据。
