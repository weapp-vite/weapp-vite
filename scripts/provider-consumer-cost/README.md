# 四类发布包消费者的安装与加载成本

对应 #1065 的依赖减负验收及 #1142。复用现有 consumerTarballs 清单，在四个独立目录中通过 pnpm 严格安装最小直接依赖：原生仅声明 weapp-vite，Wevu/Web 增加 wevu，Tailwind 增加固定版本 tailwindcss。工作区 overrides 只将实际需要的内部依赖指向候选 tarball，不把整份候选清单声明为直接依赖，也不改变产品的依赖拓扑。

先按仓库 dist 同步要求重建候选闭包，并使用已有打包工具：

```sh
pnpm exec turbo run build --filter=weapp-vite... --filter=rolldown-require...
node packages/weapp-vite/scripts/consumerTarballs.mjs .cache/provider-cost-tarballs
node --import tsx scripts/provider-consumer-cost/index.mjs prepare .cache/provider-cost-consumers .cache/provider-cost-tarballs
node --import tsx scripts/provider-consumer-cost/index.mjs measure .cache/provider-cost-consumers
```

prepare 要求输出目录尚不存在，不覆盖已有项目；可直接将最后一个参数替换为已冻结候选的 tarball 目录。四份安装共享相同候选归档 SHA256，分别记录 lock SHA256、严格安装日志和安装墙钟。沿用现有消费者安装器，仅为 `@swc/core` 与 `esbuild` 显式允许构建脚本，不忽略脚本或 peer/engine 约束。pnpm 下载缓存不清空，安装时间不能解释成冷网络基准。失败目录保留，修正后新建一组目录；不要只挑一次失败样本覆盖重测。

归档 SHA256 与 pnpm 使用的 SHA512 integrity 在准备开始时由同一份字节冻结；后续四次安装都对比初始 integrity，不接受同版本归档在准备途中被重打。输入 hash 同时覆盖源码、`package.json` 与 `pnpm-workspace.yaml`，测量前依赖清单或 overrides 有任何变化均失败；旧版未记录安装合同的准备清单必须重新 prepare，已有历史报告保持原样。

measure 只启动串行生产构建，不启动 dev/watch、浏览器、模拟器或 IDE。每类消费者执行五次无 hook 的新进程构建，再额外执行一次带同步 Node resolve/load hook 的构建。首次样本原样保留；未清文件系统缓存，后续样本不是冷启动。每次检查该类别的实际产物，并验证各次构建及探针开关前后完整 dist 字节相同。原生/Wevu/Tailwind 检查小程序页面文件，Tailwind 还检查最终 WXSS import 链中的宽度语义；Web 检查浏览器入口。这些检查不替代页面交互验收。

cost-report.json 分开记录：

- 实际安装树的逻辑文件字节、文件数与链接数；不等于压缩下载量、磁盘块或运行时内存。
- 依据实际 node_modules 解析的依赖图，同名嵌套版本保持独立；可选平台缺包单列，必需依赖缺失失败。
- 未插桩生产构建墙钟样本。
- 额外插桩构建的解析边、已解析/已加载模块、文件字节、最终/峰值 RSS。
- 历史审计链 weapp-vite → weapp-tailwindcss → @mpxjs/webpack-plugin → @mpxjs/utils → @mpxjs/core → @mpxjs/api-proxy → axios 的每条实际安装路径，以及相关包的实际加载情况。

探针只观测主 Node 构建进程，不覆盖 native 引擎内部读取、其他进程或已打入 bundle 的内部模块。解析成功不等于加载，加载不证明调用某个函数，更不证明漏洞可利用。工具拒绝解析到消费者之外的文件，报告和日志脱敏本机绝对路径，保留失败样本；不会把延迟 import 宣称为安装体积下降。

本工具不拆包、不改 optional/peer、不替换上游依赖，也不默认声称任何收益。后续优化须使用同一组输入、候选身份、Node/平台和安装策略做前后对照，分别判断安装成本与实际加载变化。没有正式四类测量报告时，#1065 的该项验收保持未完成。

最小回归：

```sh
pnpm vitest run -c scripts/vitest.config.mjs scripts/provider-consumer-cost/cost.test.mjs
```
