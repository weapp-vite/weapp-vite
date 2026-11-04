# 自产框架矩阵夹具

本目录维护七个固定框架版本的受控输入配方。它们具有唯一 `controlled-fixture` 身份及 `quotaEligible: false`，用于实际开发/生产编译和语法回归，不计入真实模板、真实非微信来源或独立公开仓库数量。

`prepareMatrixFixture(framework, version, outputDir)` 输出原始源码、逐文件哈希和 `fixture.json`。构建必须传 `controlledFixtureId`（CLI `--fixture-id`），生成器将模板放入 `matrix-templates.jsonl`，不放入真实语料 `documents.jsonl`。真实语料继续来自冻结的公开上游工程。

uni Vue2/Vue3、MPX 与 Taro2/现代 Taro 使用各自框架架构，不能把同一模板改扩展名冒充平台输出。每份输入包括主页面、组件与分包页面，覆盖条件、循环、事件、实体和 Unicode。uni/MPX 覆盖默认及具名 slot；Taro 独立记录 React children，不声称它是原生具名 slot。

MPX 的 wx 原始内联脚本交给官方编译器做目标转换。uni 的内联 WXS 仅在明确的微信条件编译区域出现，其他目标不借用该用例证明支持相同脚本语法。Taro 的大型基础模板由官方 runtime 自身生成，不人工伪造基础模板。

源码配方存在不表示实际构建成功；每个版本 × 实际支持目标 × mode 仍须完成原生编译、产物校验和 parser 验收。工具链不支持的特性及失败须保留在矩阵中，不能通过更换输入方言或伪造产物跳过。
