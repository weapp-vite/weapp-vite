# @weapp-vite/acceptance

## 0.1.0

### Minor Changes

- feat(acceptance): 补齐确定性验收、Doctor、构建产物与 HMR profile 的可追溯证据，未知或未完成测量不再被记录为成功或零耗时。

  - 复用现有 MCP/runtime 会话提供无模型检查、任务管理和当前代码证据；任务在项目锁释放后再发布完成状态，Windows 报告原子替换遇短暂占用时限时重试并保留持久化与清理错误。
  - 共享 Doctor CLI/API 分离默认只读静态检查、显式构建产物和已打开宿主页面探针，提供终端、JSON、SARIF 与完整性退出码；复用平台兼容及预算规则，修正 runtime ESLint 对自定义实例方法和数组/字符串同名方法的误报。
  - analyze 产物清单按实际模块所属包区分 runtime、业务及混合输出，保留分包复制来源，明确实际字节、模块分摊估算与未归因部分；新增 runtime 文件上界和单包预算，缺测拒绝报告通过，失败关联具体文件，JSON 构建/清理日志走 stderr。
  - profile 固定版本、会话、构建、多文件批次及实际生产者身份，记录源事件、准备、提交等待、提交和发布，区分 classic/stateful 边界；失败、缺失阶段、未知版本和未完成批次不计成功，嵌套阶段不重复累加，保留旧 JSONL 兼容和残差估算口径。

- feat(upload)!: 升级上传、预览和验收命令的配置、环境变量及超时契约；MCP 升级为 major，验收包与 MCP 最低 Node.js 版本调整为 22.12.0。

  - 验收迁移至 Execa 10，取消或超时同时清理本次后代进程，超时后即使子命令返回零退出码也记录失败。
  - 上传/预览迁移至 dotenv-expand 1000，环境文件支持命令替换，以及提供 `DOTENV_PRIVATE_KEY` 时解密 `encrypted:` 值；区分空值和未设置变量，解析及跨文件覆盖遵循有效声明顺序，引用复用命令输出和解密结果。
  - 已有进程变量（包括空字符串）优先，不执行被覆盖的文件值且不修改全局环境。迁移时请先声明基础变量；需要原样传入包含命令文本的凭据时使用 CI Secrets 或进程变量，不经文件二次引用。

### Patch Changes

- fix(acceptance): 修复 Doctor 会话清理、HMR profile 交接与测试产物缓存的归属和失效边界。

  - Doctor 分阶段保存宿主事实及脱敏清理证据，共享总预算；工具信息失败仍保留已连接事实，释放本次连接而不误删持久化会话。原生 CLI 登录查询仅显式启用，只采信布尔结果，超时或无效响应保持未知。
  - 拓扑替换独立移交原始计时与时钟，仅在完整产物发布后结算；保留重启失败、交接失效和关闭诊断。畸形枚举记录被跳过而不影响后续合法样本，异步写入使用已固定快照。
  - profile 监听只排除实际启用的输出文件，避免失败重建自触发；关闭 profile 时同名用户文件及相邻源码仍可触发更新。
  - 测试产物按进程、配置和 generation 隔离，基于源码、配置依赖和产物内容验证缓存，避免旧结果复用或覆盖在用产物；内容摘要去重重复通知，保留显式重建、构建中再编辑、合并更新、可等待关闭及过期缓存失败隔离。

- chore(deps): 合并本轮 catalog、生产依赖和构建工具链升级，联动所有受影响可发布包及脚手架，保持现有公开 peer 范围和各包声明的最低运行环境。

  - 同步 Vite、Rolldown、Babel、Oxc、Devframe、Sass、Tailwind 引擎、AI/MCP SDK、CLI 依赖及工作区锁文件；脚手架模板 catalog、React SWC 和生成 AI 指引随构建基线更新。
  - Rust Oxc/N-API 适配新版解析结果与箭头函数 AST，保留批量分析、嵌套函数边界及可选 native 回退。
  - 对齐 React 19.3 / reconciler 0.34 所需异步提交 hook，修复 `startTransition` 因缺失宿主方法而失败。
  - 适配新版 Vite 样式客户端，防止 DOM 客户端进入小程序 stateful HMR 产物；迁移 Vite/Rolldown 生命周期补丁并接入上游 macOS 原生 watch 修复，减少连续保存和拓扑更新丢失事件。
  - 适配上游 stateful ESM 图及内联 helper，在原生输出 hook 保留宿主 CommonJS 格式、sourcemap 和完整 runtime 契约。
  - 更新 uview-plus 与兼容矩阵，保留 `u-flex` / `up-flex` 自动导入、组件交互及 `u-video` 覆盖；条码 nextTick 补丁因上游已修复而移除。
  - 更新 repoctl 并移除上游已实现的发布补丁，保留 catalog 消费者、共享 constants 依赖和固定版本组的联动发布。
