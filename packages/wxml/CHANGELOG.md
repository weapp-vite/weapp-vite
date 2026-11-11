# @weapp-vite/wxml

## 0.0.1

### Patch Changes

- chore(deps): 同步工程配置、AI SDK、Dashboard、Tailwind 与组件依赖。

  更新工作区与脚手架内置 catalog，采用 TDesign 1.18.0、weapp-tailwindcss 5.7.3 和 devframe 配套包 1.3.3，同步 ESLint、Stylelint、AI SDK、axios 及相关解析器。保持 TypeScript 6.0.3、Vite 8.3.5、Rolldown 1.2.16 和 Vite+ 1.5.0，保留原版本声明形式及公开 peer 最低兼容范围。

- chore(deps): 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@ai-sdk/anthropic, @ai-sdk/openai, @ai-sdk/openai-compatible, ai, sass, sass-embedded, vue-router, weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。

- chore(deps): 升级 AST、构建声明、脚手架和请求传输依赖。

  同步 Oxc JS 类型与可选 Rust 分析器至 0.158.0，更新 oxfmt 0.78.0、ignore 7.0.14、ws 8.22.2、dotenv 18.0.10 和 rolldown-plugin-dts 0.30.1。保留现有公开 API、类型契约及 native 的 JS fallback。

  声明构建改用 rolldown-plugin-dts 的 `dtsOnly`，消除默认构建中的弃用告警，保持声明产物契约。

- chore(deps): 自动补充依赖升级发布记录。
  涉及包：
  - create-weapp-vite：dependencies.@inquirer/prompts

## 0.0.0

### Minor Changes

- feat(wxml): 新增可在 Node 和浏览器运行的多平台模板解析与序列化包

  支持保留原文的受控编辑、完整源码范围、裸属性和脚本边界。统一构建、语言工具、Web 和 simulator 的模板解析基础，并提供与 htmlparser2、dom-serializer 对照的可复现性能基准。

- feat(wxml): 新增平台无关模板核心与声明式方言预设，保留编辑上下文并统一模板消费配置；提供冻结主线性能对照，去重相同测量任务并增加快速诊断与组合验收入口。

- feat(wxml): 新增路径式模板编辑并升级实体解码依赖。

  支持按节点类型配置 enter/exit 访问器、查询当前父子与兄弟节点、读取修改后的属性和标签、控制子树遍历，以及继续编辑插入或替换后的节点。保留函数回调编辑的原有快照行为和未修改源码格式。

  将实体解码依赖 entities 升级至 9，补充 XML 数字实体、未知实体和模板绑定边界的解码回归覆盖。

### Patch Changes

- chore(deps): 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@tailwindcss/vite, tailwindcss, tsdown, vue-eslint-parser。命名 catalog 变更键：tailwind4(tailwindcss)。

- chore(deps): 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@ai-sdk/anthropic, @ai-sdk/openai, @ai-sdk/openai-compatible, @tanstack/vue-query, ai, sass。命名 catalog 变更键：无。

- chore(deps): 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@weapp-tailwindcss/engine, miniprogram-api-typings, sass-embedded, weapp-tailwindcss。命名 catalog 变更键：latest(miniprogram-api-typings)；weapp-tailwindcss-fixed(weapp-tailwindcss)。

  同步脚手架默认依赖和微信 API 清单，支持 typings 5.3.1 新增的六个接口。
  wevu 同步宿主实例查找的可空返回值、glass-easel 静态组件选项及生命周期错误参数类型，并补充公开类型契约验证。

- chore(deps): 升级编译、运行时与开发工具依赖并同步脚手架版本。

  本轮接受 58 个 npm 直接依赖升级目标，同步包内版本声明、默认 catalog、tailwind4 catalog 与脚手架模板，更新 Babel、Vue、Tailwind CSS、Oxc、AI SDK、Devframes、Vite+、Vitest 等编译、运行时和开发工具依赖。Rust Oxc 依赖与 JavaScript parser/types 同步到 0.157，保留原有版本前缀及公开 peer 兼容下限。

  将多包共用的依赖声明归并到 workspace catalog，并同步脚手架内置映射；精确版本、`^`、`~` 的原有范围和锁定结果保持一致，减少后续升级时的重复维护。

  Vite+ 更新到 1.5.0，内置 Vite 8.3.5 与 Vitest 5.1.0。独立 Vite 8.3.6 未通过优化器关闭生命周期诊断，本轮保留 8.3.5；TypeScript 及其余兼容保留项继续沿用原基线。

  修复内联 WXS/SJS 在 Vue SFC、Web 转换和 HMR 解析中的原始脚本保护，保留行注释、运算符与标签字面量，避免组件扫描误读脚本正文。复用统一脚本边界解析，不增加公共 API。

  补齐 VS Code 扩展构建中的 WXML 源码解析依赖，缺失的模块会阻断构建，避免生成不完整的扩展包。

- chore(deps): 自动补充依赖升级发布记录。
  涉及包：
  - @wevu/web-apis：dependencies.web-streams-polyfill
  - create-weapp-vite：devDependencies.oxfmt
  - weapp-vite：dependencies.rolldown-plugin-dts

- chore(deps): 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-agent/cli：dependencies.commander
  - weapp-vite：dependencies.@volar/language-service
  - create-weapp-vite：基于 weapp-vite / wevu 的依赖升级联动更新脚手架模板

- fix(wxml): 修复带引号属性相邻时的解析与受控编辑，按微信、支付宝官方编译器的词法结果在 legacy 与 xml 方言中保留这一合法写法，保留属性顺序、重复项和源码范围。方言选择继续区分宿主转义与实体行为，不作为严格 XML 合规开关。

  语言服务的分析与模板格式化接入实际平台的方言和原文标签配置，支持通过 syntax 显式覆盖，保留公开无平台词法接口的 XML 兼容行为；格式化保留 legacy 属性转义与脚本原文，诊断继续映射到原始源码。

  京东与 QQ 分别默认识别 jds、qs 脚本正文及对应语言服务文件扩展名，避免脚本中的伪标签进入模板树，同时保留其他平台同名自定义组件的普通节点语义。补充全平台离线语料、固定种子组合、严格覆盖率及宿主与 simulator 回归入口，明确冻结范围与尚待验收的门槛。

  修复京东原生模板的 JDS 依赖遗漏：按平台登记原生模块，保留 `.jds` 文件、递归依赖及模块正文，模板清理、编辑、引用检查和 scoped style 使用同一边界；其他平台的同名组件继续按普通节点处理。京东通用脚本编译仍使用既有 WXS 配置。

  优化普通成员路径绑定、脚本字符串和 XML 属性解码，实体引号查询限制在已声明的长度窗口内，减少重复扫描与不必要的词法状态分配；保留复杂表达式回退、原始范围和错误诊断。
