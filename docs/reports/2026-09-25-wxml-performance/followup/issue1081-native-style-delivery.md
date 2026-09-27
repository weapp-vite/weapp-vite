# #1090：原生样式限制与批次交付顺序

## 无框架的原生对照

Computer Use 操作微信开发者工具 2.02.2609231，运行时实际 SDK 3.17.3。原生 App/Page/WXML/WXSS 文件从启动即齐全，不加载 weapp-vite、wevu、Tailwind、bundler 或 automator。WXML 从始至终是 `class="{{mode}}"`；已有按钮把 mode 从 before 改为 after，并递增 count。

初始 `.before` 为粉色，计算背景色 `rgb(252, 231, 243)`。仅向页面 WXSS 新增 `.after { background-color: #dbeafe; }`；正常点击原有按钮后，`#utility.after` selector 数量为 1，事件/页面栈 mode 均为 after、count 均为 1，但计算背景变为 `rgba(0, 0, 0, 0)`。App 启动标记保持。

一次普通 IDE 菜单“编译”后再点同一按钮，背景为正确的 `rgb(219, 234, 254)`。编译前后全部七个源码文件的字节 SHA、大小和 mtime 完全相同。该完整文件对照独立复现新增 CSS 规则未被 IDE 热重载应用，排除框架批次、客户端确认与构建器参与是此现象的必要条件。没有篡改 IDE、强制注入、额外 touch 或手写构建产物；只编写和编辑原生源码。

## 当前批次实现的只读 trace

在产品 HEAD `49026d185732824acb4c13dbb2350be463e33f39` 上，使用已有 `WEAPP_VITE_STATEFUL_HMR_SNAPSHOT_TRACE=1`，临时把运行态诊断移到原颜色断言之前。原断言保持，仍失败于首次蓝色更新，1/3 DOM；不冒称通过。

真实记录的顺序（UTC）：

1. 16:31:16.543：批次 revision 161 开始提交。
2. 16:31:16.554：原生写入完成，页面 WXSS 与全局 WXSS 均记录新字节 SHA。
3. 16:31:16.555：开始发布补丁。
4. 16:31:16.566：update.js 原生写入完成。
5. 16:31:16.679：服务端收到执行确认。

客户端版本 0→1，lastApply changed=2、initialized=2、missing=0；页面与 App 标记保留，页面 class 与实际输出的蓝色 CSS selector 匹配。之后计算背景仍透明。结合独立原生对照，可按用户已授权的已证实宿主限制口径接受该失败；不能声称原 IDE 样式断言通过。临时 suite 观察器已恢复，无产品改动。

合入 #1086 后仍须重新构建并验证最终组合；本报告当前只证明上述指定 HEAD 与原生宿主对照。Nightly 继续非阻断，普通 CI 全绿要求不变，#1081/#1082 保持开放。

## #1086 整合预演

组合候选以 #1090 `49026d185` 与 #1086 `27cdbabcd` 为父版本；最终远端合并仍先 #1086，再普通 merge 已包含它的 main 到 #1090。此次预演不伪装成最终 HEAD CI。

手工处理 session、snapshotBuild 和 JSX 冲突，清单由 write/check 生成并保留双方全部场景（113 tasks / 300 cases / 0 missing）。批次交付仍独占同一源事件的视觉编译，public/copy 的独立监听保留；JSX 恢复使用真实客户端请求和执行，不恢复手工 apply 的旧测试装配。

新增两项回归证明单纯文本合并会漏掉编译批次的资产删除和部分写入清理。修正为编译批次与普通快照共用提交方法，保留可靠磁盘基线、未提交资产归属及删除集合；不新增写出者。最初测试把原始 CSS 断言在 app.wxss，已纠正为既有全局样式资产；纠正后的旧实现仍在两项删除断言失败。修正后六文件 84 tests、真实 JSX 集成、类型/公开类型与 weapp-vite/wevu/simulator 构建通过。

严格 headless 两文件八场景 46/46 DOM，覆盖新增计算/事件、模板往返、独立脚本/store、public/copy 删除恢复和 #1081 完整批次场景。真实 IDE 原生模板与 Wevu 脚本三场景 18/18 DOM。原 #1081 样式场景仍 1/3：新原生 writer 在 16:57:58.423 UTC 完成样式写入，.424 发布，.430 完成 update.js 写入，.453 收到执行确认；client 0→1，changed/initialized=2、missing=0，页面/App 标记保持，随后计算背景透明。与原生完整文件对照一致，按已授权口径保留失败并接受此宿主限制。

临时 observer 已恢复，最终产品源码 hash 随归档记录，正式 main 整合后逐项核对；产品变化后已先重建 dist，再运行上述下游验证。session 既有大文件内只新增一个共用提交方法，避免两条交付路径再次分叉；变化已补入中文 changeset。

相同 Performance Smoke HMR 收集入口在组合候选上完成 TDesign 四场景、16 条编辑/恢复记录，未出现交付或生命周期错误。原 500ms 超限继续保留；该局部正确性运行不是三系统正式性能通过。

[完整脱敏原生与整合归档](./issue1081-native-style-and-integration.json.gz)：29 份记录，解压 496290 bytes，SHA256 `1bb0cf018d0c90247f63664109df3feaae6f41746ae701eaef1a05d92888717f`。原件与源码 hash 单列，保留首次失败和测试装配更正。

合并后的清单、控制端口与 headless transport 三文件 42 项基础设施回归通过。

## 正式 main 整合

#1086 已在最终 HEAD `d38c3b2bd` 普通 CI 31 success / 10 skipped、转正式新增 Runtime Size 通过后 squash 合入 `002413456c0577484b474ffe483f812e39c64bec`。本分支普通 merge 该 main；归档七个产品、回归和 changeset 文件的 SHA 与预演逐项完全一致，随后重新构建对应 dist。新增的共享编译夹具导出修正由 main 原样保留。最终 PR 仍以本次提交的普通 CI 为准，未使用旧 HEAD 绿灯。

## Smoke 模板伴随补丁的消费修正

正式组合 HEAD `52a742636` 的 Performance Smoke 在 Wevu 模板恢复失败：源码已移除 marker，WXML 仍保留 marker。CI artifact 原件 SHA 为 `e22f21e9562487d2f8f3206fb9ef85096d4d264a3100c7420b8a79c71c9ffaa9`。本地使用相同 Wevu 收集入口复现。模板新增节点经 #1086 的正确分类生成绑定脚本，但审计只消费 script 类场景；资产被观察到后尚未确认的补丁挡住下一批恢复。

共用审计 helper 在原产物 wall-time 记录之后消费新增 Vue 节点伴随的脚本并显式确认，Workspace 的测量、预热及恢复共用此边界。脚本计时、资产计时、轮询间隔、超时、样本数、阈值均未放宽。旧服务器不声明 explicit-v1 时不新增 poll/ack。实际宿主客户端不变，产物消费仍不冒充 JS 执行。

修正后 Wevu 四场景16条编辑/恢复完整收齐，Workspace Wevu 三场景通过；原超限保留。13文件54项相关回归、审计 helper 的 scoped TypeScript、lint 通过。额外广域 scripts typecheck 在基底与修改后均有既存错误；对照未引入新诊断，并补齐触碰的 Vue 场景数组上下文类型，不声称全 scripts 类型检查通过。

本轮仅审计/测试/报告变化，产品源码和 dist 与52a一致，不新增 changeset。两个既有大型审计驱动仅接入共用消费 helper，不各自实现传输循环。复用的本地 runner 的候选描述保留了旧预演标签，实际基底52a及新增驱动源码 hash 另行记录，不据该标签宣称最终HEAD正式性能通过。

[CI失败、局部前后验证和类型对照归档](./issue1081-template-audit-acknowledgement.json.gz)：42份记录，解压 1044542 bytes，SHA256 `12ad792ae439ce1cf8e112f1fa8a256ff4716879aef5da63bc46f938ddb009bf`。
