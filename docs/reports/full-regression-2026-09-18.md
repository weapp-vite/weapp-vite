# 本机全量回归与修复记录

状态：本机全量检查与可定位修复已执行，已按根因完成 15 个本地提交；真实微信 IDE 尚未完成最终验收，不能宣称全量通过。不推送、不创建 PR。

基线 `291f9fc6d`，分支 `codex/full-regression`。环境为 macOS、Node 26.5.0、pnpm 12.4.2；真实微信开发者工具为 2.02.2609162 Nightly。所有 E2E 全局串行，长时间任务保持系统唤醒；每次启动前检查本 worktree 的残留测试进程。

## 命令与结果

| 检查 | 结果 | 覆盖及说明 |
| --- | --- | --- |
| 锁文件安装 | 通过 | 160 个 workspace 项目 |
| `build:core --force --concurrency=2 --continue=always` | 37/37 通过 | 缓存命中 0 |
| `build:apps --force --concurrency=2 --continue=always` | 68/68 通过 | apps/templates 及依赖；缓存命中 0 |
| macOS CI 等价筛选范围的强制构建 | 99/99 通过 | 沿用 CI 排除故意损坏的 Tailwind4 fixture；缓存命中 0 |
| 网站构建 | 通过 | `pnpm --filter website-weapp-vite build` |
| 全仓逐包 typecheck | 60/61 通过 | 唯一非零任务 `wevu-bug` 故意包含 4 个类型错误；已与 fixture 源码逐项核对 |
| 最终 `test:types --force --concurrency=2 --continue=always` | 25/25 通过 | 强制执行，缓存命中 0；后续修改按包补验 |
| Node 26 `test:coverage` | 1107 文件、10420 测试通过 | 12 文件、18 测试按既有配置跳过；退出码 0 |
| 全量 ESLint | 0 错误、259 警告 | 后续增量修改已运行针对性检查 |
| 包级 `lint --force --concurrency=2 --continue=always` | 42/42 通过 | 缓存命中 0 |
| 全量 Stylelint | 通过 | 独立样式及 Vue style blocks |
| changeset frontmatter | 通过 | 所有行为修复均有中文 changeset |
| `e2e:ci:full` | 最终严格 70/70 通过 | 旧 emit 断言修复后，完整严格重跑通过 |
| HMR guards | 最终严格主清单 27/27，另三组各 3/3 | root-import 旧断言及 JS 产物稳定性回归均通过完整重跑 |
| 新增模板 HMR 产物稳定性 | 通过 | 模板更新后所有 JS 字节保持一致；相关 helper 单测 44/44 |
| `ide-headless-full` | 最终严格 37/37 通过 | 包含新增综合示例；源码修复后完整重跑通过 |
| 严格 `ide-dom-headless` | 27/27 通过 | 包含新增综合示例的实际 DOM 检查 |
| 综合示例 headless / 真实 IDE | 各 7/7 通过 | Options API、生命周期、created export、能力探针、TDesign 事件；真实 IDE 使用 direct 启动 |
| Simulator 完整 browser E2E | 42 文件、90 测试通过 | 全部模拟器修改后重跑；覆盖 export、无后缀模板 import、模板更新和路由保留 |
| glass-easel browser | 通过 | 实际构建与浏览器脚本退出码 0 |
| Web E2E | 最终严格 7 文件、76 测试通过 | Playground 新增回归包含在整组严格重跑内 |
| Web 项目构建矩阵 | 49 项通过 | 其中 1 项预期编译失败，按契约验收 |
| Firefox / WebKit smoke | 2/2 通过 | 浏览器依赖已确认可用 |
| 多平台构建 | 6 文件、35 测试通过 | 微信及其他目标构建；未运行其他平台真实 IDE |
| 内部 E2E 工具测试 | 68 文件、658 测试通过 | suite、报告、启动及测试桥接工具 |
| 教程契约 | 2 文件、13 测试通过 | 教程步骤及契约 |
| 本地源码教程 | 4/4 场景通过 | 创建器、Wevu counter、多平台原生、多平台 SFC |
| 创建器 `prepack` | 通过 | 模板整理、目录生成及实际构建 |
| VS Code host smoke | 通过 | 实际 extension host 退出码 0 |
| VSIX E2E | 通过 | standalone 和 Vue Official 安装场景退出码 0 |
| workspace nightly HMR | 75 项目、227 场景全部通过 | 未执行场景 0，性能阈值通过，退出码 0 |
| 真实 IDE exhaustive | 完整执行，尚未通过 | 98 项范围内任务：87 通过、10 失败、1 验收阻塞；3 项百度可选任务范围外 |

实际 suite 任务和 nightly 场景见 [机器可读清单](./full-regression-2026-09-18-suites.json)。不同入口包含重叠任务，表格中的数字不相加作为独立用例总数。

Node 26 覆盖率聚合为：语句 61.55%、分支 54.72%、函数 62.77%、行 66.45%。覆盖率不等同于所有行为均已覆盖。

## 根因与修复

- Playground：干净环境构建会读取尚未生成的下游 tsconfig，复用已有 Vite/Oxc guard；Babel 浏览器适配层手写导出清单遗漏实际编译器使用的符号，改为完整导出。新增真实浏览器回归覆盖初始编译、模板产物、语法错误和恢复。新增测试自身的 NODE_ENV 和 CodeMirror 选择器问题已修正，没有记为产品缺陷。
- React 与 Wevu 混合类型：React TSX 使用 React JSX 类型，同时保留 Wevu SFC 的平台 intrinsic 桥接；源码回归与实际 React 模板/fixture 类型检查均通过。
- Wevu 公共类型：补齐宏组件名称，统一 Options Store 的完整实例上下文，为 computed/methods 提供 data、props、methods 与 setup 解包后的 this；补充并通过 tsd。
- Volar：vue-tsc 精简 AST 不保证提供 getStart/getEnd，改用位置字段与 TypeScript 扫描器；回归验证表达式映射、周围源码及真实 app typecheck。
- 模拟器原生选择器：递归识别 wx://component-export，包括嵌套 behavior；页面和组件原生选择器使用 export 返回值，testing bridge 保留原始实例。Node、browser 和真实 IDE 对应场景通过。
- 模板 import：省略 .wxml 后缀在真实 TDesign side-bar 可用，模拟器原先读取失败；共享导入层补齐后缀，保留显式后缀、嵌套相对路径和根路径覆盖。
- 综合示例：修复循环别名、组件事件 payload、数值 props、保存退出状态结构、Options API 类型上下文；created setup 的响应式 setData 计数会更新自身，改为非响应式计数与显式刷新快照；主动分包加载按实际宿主能力显示入口。
- 稳定 HMR 产物：全量构建给已稳定的公开组件工厂和生命周期 hook 加了兼容包装，增量构建省略 vendor 时没有包装，造成无关 JS 改写和页面重启。仅为确实需要别名或缺失导出兼容的调用保留回退；新增全量/增量单测及模板更新所有 JS 保持一致的 CI 断言。
- 测试与 lint：两个旧构建/HMR 断言改为验证稳定事件转发和共享 hook 语义；禁用外部 formatter，独立样式交给 Stylelint；第三方源码、负向 fixture、Web 与小程序专属规则按实际作用域区分。

模拟器已有大型 session/render 文件只增加原生选择器适配，export 行为集中到独立 helper。大型 bundle helper 仅收紧两处兼容回退，回归放在独立文件；本轮不扩大这些文件的重构范围。仅调整 lint 格式的大文件同样保留现有结构，避免混入与缺陷无关的拆分。

## 真实 IDE 验收与剩余限制

完整严格 exhaustive 执行约 5373 秒，退出码 1。实际清单 101 项：98 项微信全部启动，87 通过、10 失败、1 项缺少 DOM 报告而验收阻塞；3 项可选百度 runtime 不在本次范围。清单覆盖 257 个展开用例，缺失计划、无法解析的参数化均为 0。任务全部启动不代表内部场景全部完成：template dev-open-all 在首个模板失败，后续 10 个模板未进入该入口的 runtime 验收。

未通过项分为：

- 首次模板更新后仍显示旧内容：snapshot wrapper、stateful HMR、Wevu Tailwind TDesign HMR、JSX/TSX HMR；后续 core HMR 复测也在 SFC 模板更新处复现。
- 自动打开或首屏未完成：CLI workflow 的 dev-open 热键、layout message、layout vendor HMR、template dev-open-all、template Tailwind dev-open-multi、TDesign template HMR。协议表现包括页面元数据为空、rawPath 读取失败和 warmup 超时。
- core HMR 原先还包含错误共享状态预期，已按原生对照校正；脚本与样式阶段通过，但 SFC 更新仍失败，因此整项继续记为失败。

### 原生 HMR 对照

最小原生 App/Page 直接修改 WXML，绕过 weapp-vite、snapshot 以及日志桥，仍复现第一次模板更新丢失：等待 15 秒无效，第二次及后续更新约 0.27～0.82 秒生效。已分别验证 bridge/direct、不同长度/相同长度、启动后额外等待，以及不订阅日志的原始 Automator；排除 bundler、字符串长度和早期 CDP 日志订阅作为必要条件。产物中的新 marker 已存在，实际 DOM 和 storage probe 仍为旧值。保留所有真实 DOM 断言，没有追加虚假更新或放宽断言。

当前 Nightly 2.02.2609162 实际基础库为 3.17.3，Tool.compile 返回未实现，engine build HTTP 端点缺失。现有证据支持宿主首次更新/启动问题，但不宣称所有 HMR 路径均已排除产品缺陷。

### IDE 恢复与 CLI 修复

日志桥有独立代码缺陷：会把调用方 60 秒启动预算无条件截为 3 秒。修复区分连接探针与新建会话，新建会话保留完整预算。新增 5 组回归，所属测试 16/16、包级 typecheck、构建和 ESLint 通过。重建后可以保存就绪 automator 会话，不再出现原端口冲突；自动首屏验收仍未通过。

已通过 Computer Use 检查登录、项目与模拟器，尝试重新打开和重新导入。暂停无响应模拟器时，调试栈仅在 WAServiceMainContext 的 setInterval，不能据此认定业务死循环。最终点击 layout-power-demo 的“重新编译”，页面正常显示“布局演示”和布局切换控件。手动恢复证明产物可运行，但不替代自动打开首屏的测试通过；相关场景仍为“未完成最终验收”。

新增综合示例 7 项在完整真实清单中通过；第三方请求客户端 7 项通过，没有额外跳过。完整清单伴随 HMR guards 的 sentinel 仅用于同轮去重，不作为额外执行证据。

## 初始条件分支的真实宿主生命周期修复

uview-plus 的 notice-bar 在真实微信首次挂载时报 `this.text.split is not a function`。纯原生最小复现确认：宿主先创建默认 row 分支，再执行父组件 created 和传入 column props；已被替换的 row 仍收到 ready，但从未收到 attached/detached。Wevu 误将这个 ready 当作已挂载实例的 wrapper 丢失，重新初始化计算属性，导致数组调用 split。

修复使用 WeakSet 记录 created 后尚未 attached 的实例，保留其原生 ready 回调，不补挂载 Vue 实例。既有已挂载 wrapper 恢复路径保留。模拟器 Node 和 browser 同步默认子树创建及被替换分支的 ready 顺序，新增共享生命周期 fixture、unit 和 browser E2E。新队列放在独立 helper；现有大型 render 文件只接入创建/清理阶段，不混入无关结构调整。

- Wevu 全包：93 文件、1115 测试通过；typecheck、构建和新文件 ESLint 通过。
- simulator 全包：73 文件、1451 测试通过；完整 browser E2E 42 文件、90 测试通过；typecheck、test:types 通过。
- 真实微信 `UVIEW_PLUS_COMPONENT_FILTER=up-notice-bar`：1 项通过，runtime error/exception 均为 0。
- 修改后严格 `e2e:ide:headless:full` 与 `ide-dom-headless` 已多次通过，最新 dist 复验结果见最终增量复验。

## 增强插槽与 HMR 对照

Wot select-picker 的 scoped-slot owner 数据被自动 setData 裁剪，修复将插槽实际依赖纳入父快照；无法静态分析时保留完整快照。编译器回归覆盖静态路径与动态依赖。真实场景新增 owner selectList 与 filterColumns 的完整快照断言。人工比对旧基线发现旧图只有弹层标题，修复后显示两个选项与确认按钮；该差异有明确行为依据，已在真实 owner 数据断言通过后定向重录该图，单独 Wot 整组严格复验 99/99 通过；最后完整视觉入口因 IDE 启动失败未能完成，详情见下文。

纯原生 Automator（不订阅日志）再次复现启动后第一次 WXML 更新丢失，后续更新成功，排除了日志桥影响。另一个原生共享模块对照确认：修改页面脚本后新 marker 生效，但未变更的 shared 模块计数仍为 1；此前仅含页面 data 的对照计数重置为 0。classic HMR 原断言误把共享 store 当作页面局部状态，已校正并补充模拟器 Node/browser 与浏览器 E2E：新页面局部值恢复 0，未变更共享模块保持 1。真实复测原失败的脚本与样式阶段通过，后续 SFC 模板仍触发上述宿主更新问题。

组件库视觉核对：up-button、up-calendar、up-goods-sku 的差异均为按钮从微信默认宽度变为组件样式指定的容器宽度。旧图首次提交于 `878073f881`，当时模板不生成 scopeId；后续 `4f03a92e1a` 已修复 scoped 样式属性注入。当前 WXML scope 属性与 WXSS 匹配，uview 3.8.86/3.8.113 对应按钮宽度源码相同，排除本轮修改或上游宽度变更。已逐图审查并只更新这三张历史过期基线，阈值保持不变。

中途有一轮终端意外使用 Node 25：补充 coverage 已主动停止（退出 130），同期 headless/DOM/视觉结果仅作诊断，不计为最终 Node 26 验收证据。最终命令均显式固定 Node 26.5.0；未完成的真实视觉验收保持阻塞状态。

## 最终增量复验

- 固定 Node 26.5.0，严格覆盖率退出码 0：1107 文件、10420 测试通过；12 文件、18 测试为既有跳过。增强插槽导致的唯一快照变化已核对为新增 tabItems 依赖，没有盲目更新其他快照。
- Simulator 浏览器完整复验退出码 0：42 文件、90 测试通过，包含最新共享模块状态回归。
- up-pdf-reader 严格真实视觉定向复测通过，runtime error/exception 均为 0，没有修改 PDF 基线。先前空白外部 web-view 为间歇性加载问题，完整视觉复验继续验证。
- 最新 simulator 已再次重建并通过 test:types；随后固定 Node 26 严格 headless 37/37、DOM headless 27/27 全部通过。Wot select-picker 最新 owner 数据断言的 headless 定向复验也通过。
- 完整组件视觉入口严格失败：uview 前 120 个场景已执行，轮换会话时 IDE 启动超时，Wot 因 fail-fast 未执行。Computer Use 发现 IDE 自动恢复到旧项目窗口，关闭窗口恢复项目列表后重跑，仍在初始启动时报 `[appservice] simulator launch catch error timeout`，1 个测试因 beforeAll 失败未执行。未关闭监控、放宽断言或增加跳过。
- 因此完整组件视觉验收仍为“未完成最终验收”。此前 Wot 99/99 独立严格通过、PDF 定向通过，以及本轮前 120 项不能代替整组入口通过。
- 6 个受影响包的最终 typecheck 全部通过；89 个改动样式文件及 Vue style blocks 的 Stylelint 通过。
- 已清理构建自动改写的 Skyline 项目热重载开关，避免把生成配置变化混入源码修复。

新增源文件均按职责拆出 helper；既有超过 300 行的 render/session、bundle 和日志桥文件仅修改所属缺陷，不混入无关重构。行为修复均有中文 changeset，Wevu/weapp-vite 相关修复同步创建器版本。最终交付只做本地提交，不推送、不创建 PR、不运行远程 CI。

## 本地提交

所有提交前均执行对应 ESLint/Stylelint，pre-commit 与 lint-staged 正常启用。工作分支 `codex/full-regression`，没有推送或创建 PR。

- `3e5a6d1ee`：fix(wevu): 修复组件与选项式 store 的类型上下文
- `2f845e225`：fix(weapp-vite): 对齐 React 与 Wevu 混合项目 JSX 类型
- `a6dc58c67`：fix(volar): 兼容 vue-tsc 精简 AST 的配置块映射
- `267ba02ef`：fix(simulator): 对齐原生组件导出与模板导入解析
- `c423ba049`：fix(runtime): 对齐未挂载初始条件分支的 ready 生命周期
- `fd89e5bab`：fix(playground): 补齐浏览器编译器导出与干净构建支持
- `0ffa402e1`：fix(weapp-vite): 保持模板 HMR 的公开 runtime 引用稳定
- `b60d6c6b5`：fix(weapp-ide-cli): 保留日志桥启动会话的超时预算
- `a2a95700f`：fix(demos): 修复综合示例并覆盖真实与 headless runtime
- `ac294f1bc`：fix(compiler): 保留增强插槽依赖的父组件数据快照
- `bc35a384e`：test(hmr): 按原生行为保留未变更共享模块状态
- `499ca7499`：test(visual): 对齐已生效 scoped 样式的按钮基线
- `b21124d5e`：chore(lint): 修正全仓检查与样式校验范围
- `835550449`：文档提交保存本记录与机器清单。
- 最后一个工具提交规范验收清单末尾换行；现有 inventory 工具测试 16/16 通过。
