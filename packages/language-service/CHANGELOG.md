# @weapp-vite/language-service

## 0.1.1

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

- feat(wxml): 新增可在 Node 和浏览器运行的多平台模板解析与序列化包

  支持保留原文的受控编辑、完整源码范围、裸属性和脚本边界。统一构建、语言工具、Web 和 simulator 的模板解析基础，并提供与 htmlparser2、dom-serializer 对照的可复现性能基准。

- fix(wxml): 修复带引号属性相邻时的解析与受控编辑，按微信、支付宝官方编译器的词法结果在 legacy 与 xml 方言中保留这一合法写法，保留属性顺序、重复项和源码范围。方言选择继续区分宿主转义与实体行为，不作为严格 XML 合规开关。

  语言服务的分析与模板格式化接入实际平台的方言和原文标签配置，支持通过 syntax 显式覆盖，保留公开无平台词法接口的 XML 兼容行为；格式化保留 legacy 属性转义与脚本原文，诊断继续映射到原始源码。

  京东与 QQ 分别默认识别 jds、qs 脚本正文及对应语言服务文件扩展名，避免脚本中的伪标签进入模板树，同时保留其他平台同名自定义组件的普通节点语义。补充全平台离线语料、固定种子组合、严格覆盖率及宿主与 simulator 回归入口，明确冻结范围与尚待验收的门槛。

  修复京东原生模板的 JDS 依赖遗漏：按平台登记原生模块，保留 `.jds` 文件、递归依赖及模块正文，模板清理、编辑、引用检查和 scoped style 使用同一边界；其他平台的同名组件继续按普通节点处理。京东通用脚本编译仍使用既有 WXS 配置。

  优化普通成员路径绑定、脚本字符串和 XML 属性解码，实体引号查询限制在已声明的长度窗口内，减少重复扫描与不必要的词法状态分配；保留复杂表达式回退、原始范围和错误诊断。

- feat(wxml): 新增平台无关模板核心与声明式方言预设，保留编辑上下文并统一模板消费配置；提供冻结主线性能对照，去重相同测量任务并增加快速诊断与组合验收入口。

- Updated dependencies:
  - @weapp-core/shared@3.4.2
  - @weapp-vite/ast@7.8.1

## 0.1.0

### Minor Changes

- feat(create-weapp-vite): 为多平台模板、样式与脚本模块提供统一的语言诊断、格式化和编辑器能力。

  新增共享语言内核，统一九种模板语言、原生样式和 WXS/SJS/KS/filter 的平台归属、作用域及模块引用。项目通过 `weapp.language` 配置按文件覆盖；CLI 与 VSCode 复用同一份离线平台资料和分析结果，提供语法与平台限制诊断、补全、悬浮、跳转、引用和重命名，不新增完整模板类型检查器。

  格式化保留模板文本、属性值、实体、引号、顺序与显式闭合形式，原生脚本采用方言校验与 AST 等价保护；全部候选文件通过检查后才写入，源码变化或非法输入会拒绝覆盖。保留 `formatWxml` 入口，新增通用格式化与组合 lint 命令。生成项目同步多平台文件关联、唯一格式化提供者和检查脚本，Wevu 保留专项 ESLint，Stylelint 扩大原生样式范围。

  项目文件扫描统一 Windows 路径表示，并将忽略规则查找限制在所属项目内，避免混合路径分隔符导致格式化命令无法结束。

  构建的脚本模块格式与标签属性按平台描述统一处理，修正抖音 SJS 的 CommonJS 输出和百度 import-sjs 的 src/module 属性。支持范围以公开矩阵与静态、CLI、VSCode host、构建回归为准，不代表已完成真实小程序 IDE runtime 验收。

### Patch Changes

- Updated dependencies:
  - @weapp-core/shared@3.4.1
  - @weapp-vite/ast@7.8.0
