# 插件模板 P/W 验收边界

默认 `wv dev -o` 保持官方 CLI 打开原项目 P；显式 `--ide-open-strategy automator` 打开本轮 journal 持有的独占快照 W。两条静态 case 分别取得 fresh owner，串行运行和完整清理，保留相同的首次 route、`pluginAnswer === 42`、运行错误检查与完整 `opened` DOM checkpoint。不通过额外导航、预热、重新编译或重复启动取得通过。

真实验收只从 `weapp-ide-cli` 正式导出读取本任务 journal 及登记子 scope。以历史已释放记录为基线，要求本次恰有一条确认 owned 记录，绑定完整安装身份、port、source P、effective path 和 W 的 snapshot provenance。生产日志消费者就绪后不得新增第二 owner；测试日志连接前后 owner 必须相同。这个采样本身不证明生产消费者之前的阶段顺序；首次启动先于消费者、消费者只能 connect 的合同同时由既有 `packages/weapp-vite/src/cli/commands/serve.test.ts` 的受管 CLI/automator 成功与连接失败矩阵锁定。

连接阶段先查询真实 runtime 版本，以保留既有 `2.02.2609082` 插件元数据缺陷记录；其他版本在同一 session 上等待首次目标 route，再检查页面数据和 DOM。两条策略采用同一就绪断言，布局不再决定是否跳过首屏。已知版本的 skip 在领域清理完成后提交给 Vitest，因此不会被启动失败冻结器误写成下一条路径的基础设施失败；skipped 不计通过。真实启动、断言或清理失败仍冻结后续启动。

清理顺序为日志订阅、dev/watch 消费者、borrower socket、exact managed owner，再验证原生窗口双销毁、端口门禁和 W removed。窗口或快照未完成清理必须保留错误；不猜测 session/hash 目录，不删除全局状态，不登出账号。headless 使用同一 production layout transform 显式准备临时 W，只验证真实布局与同一 runtime/DOM，关闭失败保留目录，不伪造 CLI 回执或 journal。

专用文件加入 templates、full、exhaustive、headless full 和严格 DOM headless。通用模板列表移出插件，保留模板名唯一；专用任务以两个完整静态 case 名为 inventory，缺任一报告、重复报告或缺 checkpoint 均不能验收。原 checkpoint 未缩减。

mpcore 的 Node session 与 browserSession 分别保留 P 的 `dist/` 与 W 的根布局。公开 demo/debug bridge browser E2E 投影相同 runtime 文件和插件 descriptor，只证明 API 42、组件 DOM、插件导航和返回宿主；磁盘项目配置解析由 Node 与 browserSession 层覆盖。没有新增公共类型、API 或产品行为，不需要 changeset。既有 simulator 测试文件保留其共享 session fixture，本次不额外拆分并复制 setup。

本批已完成 scoped ESLint、`git diff --check` 和 `@mpcore/simulator` typecheck。新增策略、journal 与清单回归 20/20 通过，连同既有 suite manifest/inventory 扩展验证共 107/107；simulator Node session/browserSession 177/177；既有受管 CLI/automator 日志消费者矩阵 4/4；automator session 12/12。本批仅修改测试、测试基础设施和设计说明，没有修改产品源代码，不要求因本批额外重建产品包。

父任务已串行完成两条策略的严格 DOM headless（2 case、2 checkpoint）及 simulator browser E2E（2 case）。浏览器首轮因 hook 中使用 `expect.poll` 未执行 case，移入 test 后两条均通过；原失败日志保留。headless 使用筛选运行，总报告继续标记 partial/incomplete，不能代替完整范围验收。

静态清单、headless 和浏览器结果不能替代最终提交对应的真实 IDE P/W 验收；该验收仍须在干净同步的根 main 运行。已完成的单测不计作 IDE case 通过。
