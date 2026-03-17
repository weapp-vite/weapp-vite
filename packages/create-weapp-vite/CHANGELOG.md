# create-weapp-vite

## 2.0.51

### Patch Changes

- 🐛 **将 `weapp-vite analyze` 的仪表盘资源从主包中拆分为独立的可选安装包 `@weapp-vite/dashboard`。未安装该包时，CLI 会提示对应的安装命令并自动降级为仅输出分析结果，不再要求主包默认携带大体积 dashboard 静态资源。** [`be412dd`](https://github.com/weapp-vite/weapp-vite/commit/be412dda3507e7c29cb25be0e90d5e5374f18fde) by @sonofmagic

- 🐛 **修复跨分包复制共享 chunk 时的 runtime 本地化遗漏问题。当子包 A 的 chunk 因被子包 B 引用而复制到子包 B 的 `weapp-shared` 目录后，构建流程现在会继续为子包 B 发出对应的 `rolldown-runtime.js`，避免运行时出现 `module 'subpackages/user/rolldown-runtime.js' is not defined` 一类错误。** [#342](https://github.com/weapp-vite/weapp-vite/pull/342) by @sonofmagic

- 🐛 **修复 `plugin-demo` 这类同时构建主小程序与插件的场景里，`app` 构建错误地把 `plugin.json` 里的插件入口纳入同一编译图、以及插件主入口导出在独立构建中被错误裁剪的问题。现在插件入口仅会在 `plugin` target 下单独解析与产出，`project.config.json` 指定的 `dist/` 与 `dist-plugin/` 会各自独立 emit 正确产物，不再共享不必要的 JS chunk，并且 `requirePlugin()` 可以正确拿到插件导出。** [`5a11167`](https://github.com/weapp-vite/weapp-vite/commit/5a111674cf4a19ca466e9453f8363a7eebe1c449) by @sonofmagic

## 2.0.50

### Patch Changes

- 🐛 **修复 `packages/web` 与仓库级构建中的声明打包 warning，减少 `pnpm build` 时的噪音日志，并为包含 Vue SFC 的 e2e 工程补齐 `wevu` 依赖声明，避免构建阶段出现误报警告。** [`2a6d379`](https://github.com/weapp-vite/weapp-vite/commit/2a6d3790d88224f17a26bfe1e0bc28532d0c6380) by @sonofmagic

- 🐛 **优化 `weapp-vite`、`@weapp-vite/mcp`、`@weapp-vite/web`、`@wevu/api` 与 `@weapp-core/schematics` 的构建产物体积与依赖边界：将可复用的 Node 侧运行时依赖改为走 `dependencies`，把 MCP SDK 相关实现和 transport 启动逻辑集中收敛到 `@weapp-vite/mcp`，让 `weapp-vite` 通过包内桥接复用 MCP 能力，同时继续抽取共享 chunk、移除重复声明产物，减少发布包中不必要的内联与重复代码。** [`43a68e2`](https://github.com/weapp-vite/weapp-vite/commit/43a68e28e7ffcc9c6e40fa033d2f346452157140) by @sonofmagic

## 2.0.49

### Patch Changes

- 🐛 **将仓库内原先使用 `tsup` 的发布包统一迁移到 `tsdown` 构建链路，并按现有产物约定保留对应的 ESM/CJS 输出后缀、声明文件生成与多入口导出结构。其中 `@weapp-vite/web` 额外改为由 `tsdown` 负责 JavaScript 产物、`tsc --emitDeclarationOnly` 负责类型声明，以规避当前 `rolldown-plugin-dts` 在该包上的类型生成异常，确保迁移后各包的发布结果与现有消费方式保持兼容。** [`d49d790`](https://github.com/weapp-vite/weapp-vite/commit/d49d79011253552daf088695bb52d158816dfec8) by @sonofmagic

- 🐛 **为 `weapp-vite` 与 `@wevu/compiler` 新增统一的 AST 抽象层，默认继续使用 Babel，并允许在多条纯分析链路中通过配置切换到 Oxc。此次调整同时把组件 props 提取、`usingComponents` 推导、JSX 自动组件分析、`setData.pick` 模板 key 收集、re-export 解析、页面特性分析与部分 emit 阶段快判等能力逐步下沉到可复用的 `ast/operations`，并补充高层配置透传测试，确保 `weapp.ast.engine = 'oxc'` 能从真实插件入口传到对应分析逻辑。** [`3836235`](https://github.com/weapp-vite/weapp-vite/commit/3836235d8784ce0e5e1bd4c920f33a82d4c28844) by @sonofmagic

- 🐛 **新增 `@weapp-vite/ast` 共享 AST 分析包，统一封装 Babel/Oxc 解析能力以及平台 API、require、`<script setup>` 导入分析等通用操作，并让 `weapp-vite` 与 `@wevu/compiler` 复用这套内核，降低后续编译分析工具的维护分叉成本。** [`7bc7ecc`](https://github.com/weapp-vite/weapp-vite/commit/7bc7ecca2aef913b0751d18f9c0f586bd582dc01) by @sonofmagic

- 🐛 **修复 Windows 环境下 HMR 对侧车文件 `rename` 保存模式的识别问题。现在对于模板、样式、页面配置等文件的原子重命名保存以及连续快速修改，会在短暂 settle 后按已知文件状态正确判定为更新或删除，避免热更新丢失；同时补充了对应的 rename-save 与连续修改 CI 用例。** [#336](https://github.com/weapp-vite/weapp-vite/pull/336) by @sonofmagic

- 🐛 **修复 npm 依赖构建在 `exports.import`、`module` 与 `main` 并存时错误回退到 CommonJS 入口的问题。现在会优先选择 ESM 入口，避免把已经转译成 `_defineProperty` helper 的 CJS 产物错误带入小程序构建结果。** [#336](https://github.com/weapp-vite/weapp-vite/pull/336) by @sonofmagic
- 📦 **Dependencies** [`d49d790`](https://github.com/weapp-vite/weapp-vite/commit/d49d79011253552daf088695bb52d158816dfec8)
  → `@weapp-core/logger@3.1.1`

## 2.0.48

### Patch Changes

- 🐛 **放宽 `wevu/router` 的 `createRouter({ routes })` 类型约束，允许路由记录只传 `path`，无需显式提供 `name`。当未提供 `name` 时，运行时会基于规范化后的路由路径自动生成名称，现有按名称解析与路由守卫行为保持不变。** [`319ed39`](https://github.com/weapp-vite/weapp-vite/commit/319ed39e0312bec9ade9008a65d79877c83108a0) by @sonofmagic

- 🐛 **修复 `autoRoutes` 在生产构建中的两个问题：普通 `build` 模式下不再错误注册 watch 目标，避免构建结束后进程无法退出；同时修复 `app.vue` 中通过 `defineAppJson` 引用 `weapp-vite/auto-routes` 时的递归解析问题，避免包含自动路由的项目在构建阶段卡死。** [`2ed7d3f`](https://github.com/weapp-vite/weapp-vite/commit/2ed7d3f01ac4fc6096351013a02e5f0d65cb8630) by @sonofmagic

- 🐛 **修复 `weapp.autoImportComponents: true` 在含有 `wevu` 依赖的项目里未自动扫描 `src/components/**/\*.vue`的问题。现在 wevu 项目会默认补上主包和分包下的 Vue SFC 组件扫描规则，生成的`auto-import-components.json`、`typed-components.d.ts`与`components.d.ts`能正确包含这些组件，而`typed-router.d.ts` 仍只负责页面路由类型。** [`934fb62`](https://github.com/weapp-vite/weapp-vite/commit/934fb62102dc39a7b9511426719db9bb07f71476) by @sonofmagic

- 🐛 **修复 `auto-routes` 在 dev watch 模式下的 sidecar watcher 启动时机，避免仅在虚拟模块加载后才开始监听，导致使用 `defineAppJson` 或运行时代码引用 auto-routes 时新增页面文件无法触发 typed-router、`app.json` 和 `app.js` 的 HMR 更新。** [`5433b5a`](https://github.com/weapp-vite/weapp-vite/commit/5433b5a8412d2c10f4ad4b148c08a2f0a23b0c2c) by @sonofmagic

- 🐛 **扩展 `weapp.autoRoutes.persistentCache` 配置，除了 `boolean` 之外也支持传入字符串来自定义自动路由缓存文件位置，并保持默认关闭持久化缓存。** [`ae76f35`](https://github.com/weapp-vite/weapp-vite/commit/ae76f3567dba591d98b804fa55fc1f88797767c6) by @sonofmagic

- 🐛 **将 `weapp` 平台默认 `build.target` 提升到 `es2020`，避免 `?.` / `??` 进入 Rolldown 的可选链降级分支；同时将历史上的 `weapp.es5` / `@swc/core` ES5 降级方案标记为已废弃，并统一将仓库内示例与 e2e 小程序的 `project.config.json` 打开 ES6 支持，配合开发者工具中的「将 JS 编译成 ES5」功能使用。** [`319ed39`](https://github.com/weapp-vite/weapp-vite/commit/319ed39e0312bec9ade9008a65d79877c83108a0) by @sonofmagic

- 🐛 **扩展 `weapp.autoImportComponents` 配置，支持直接写成 `true` 来启用增强默认值：自动使用默认组件扫描规则，并额外开启 `typedComponents`、`vueComponents`，在检测到 `wevu` 依赖时还会自动补上 `vueComponentsModule: 'wevu'`，从而简化 wevu 模板和常见项目配置。** [`f6ea730`](https://github.com/weapp-vite/weapp-vite/commit/f6ea7302ba247682600a532f20d3b094616a9dfc) by @sonofmagic

- 🐛 **将 `typed-router.d.ts`、`typed-components.d.ts` 与 `components.d.ts` 的默认生成位置统一调整到 `weapp.srcRoot` 下，减少模板与示例项目在 `tsconfig` 中对根目录生成文件的额外 `include` 与引用配置。** [`2eaebbb`](https://github.com/weapp-vite/weapp-vite/commit/2eaebbbd6e10ebcc0e29bb0a808cc38d90cf0bbb) by @sonofmagic

- 🐛 **同步升级仓库内 `miniprogram-api-typings` 到 `5.1.2`，并更新 `create-weapp-vite` 模板 catalog 与 `@wevu/api` 的类型来源、微信 API 名单生成产物，确保脚手架生成结果和 API 类型基线与当前 workspace 保持一致。** [`f3bacb9`](https://github.com/weapp-vite/weapp-vite/commit/f3bacb9197ae3ec248876dcff917a272b2009d0e) by @sonofmagic

- 🐛 **将 `weapp-vite-wevu-template` 的默认页面从功能演示风格调整为更正式的业务模板风格，统一首页、概览、工作台和设置页的信息架构、命名语义与视觉层级，减少生成项目后的演示痕迹，使模板更适合作为实际小程序项目的起点。** [`79b065e`](https://github.com/weapp-vite/weapp-vite/commit/79b065e2fed56f35bb1f07a736feaf623ea3dc38) by @sonofmagic

- 🐛 **修复 `autoRoutes` 对显式分包根目录的默认扫描回归，补齐源码 CLI 在 Node 22 下的 `createRequire` 绝对路径处理，并将 `tsconfig paths` 解析提升为 `weapp-vite` 默认行为。同步更新 wevu 模板与相关 e2e 断言，确保模板构建、分包输出和自动导入类型产物保持一致。** [`77aac93`](https://github.com/weapp-vite/weapp-vite/commit/77aac9340bcc1505aaecc3cd0ac1d569949e50fb) by @sonofmagic

- 🐛 **补充 `autoRoutes` 对 `app.json`/`defineAppJson` 中分包信息的读取，并同步更新 typed declaration 输出位置、配置类型提示与相关测试用例，确保自动路由、类型生成与配置智能提示行为保持一致。** [`d6e072a`](https://github.com/weapp-vite/weapp-vite/commit/d6e072af004daf9988255015e203f38a632ee089) by @sonofmagic

- 🐛 **修复 `weapp-vite` 在生成 DTS 时对 `@weapp-vite/web` 类型导出的解析问题：为 `@weapp-vite/web` 增加稳定的 `./plugin` 子路径导出，并让配置类型改为从该子路径引用 `WeappWebPluginOptions`，避免构建类型声明时出现缺失导出报错。** [`4b17371`](https://github.com/weapp-vite/weapp-vite/commit/4b17371069a13272d0e227c682a7d6cabaca9627) by @sonofmagic

- 🐛 **修复 `create-weapp-vite` 中 catalog 占位符解析测试对 `miniprogram-api-typings` 版本的硬编码断言，改为跟随生成 catalog 的当前值校验，避免 workspace catalog 升级后出现误报失败。** [`3d96894`](https://github.com/weapp-vite/weapp-vite/commit/3d9689411ca61fd3a14150553663e61093efbc60) by @sonofmagic

- 🐛 **扩展 `weapp.autoRoutes.include` 配置，支持使用多个 glob 或正则来自定义页面扫描目录与深度，并允许配合 `weapp.subPackages` 识别非 `pages/**` 结构下的分包页面。** [`1dd8f07`](https://github.com/weapp-vite/weapp-vite/commit/1dd8f07b389af15d3b8536891b1b72bf0516b0d9) by @sonofmagic

- 🐛 **将 `weapp.autoRoutes` 的默认值恢复为关闭，避免项目在未显式声明时自动启用路由扫描；同时保留 `true` 和对象配置两种开启方式，方便在需要时再按需启用并细化控制。** [`d6ad5e1`](https://github.com/weapp-vite/weapp-vite/commit/d6ad5e1601161fd721e26730ef69e6bfe254f1f4) by @sonofmagic

- 🐛 **将 `weapp-vite-wevu-template` 模板改造成基于 `autoRoutes` 生成 `app.json`，并补充一个同样由自动路由收集的普通分包页面，便于新项目直接使用主包与分包的约定式路由结构。** [`385f95b`](https://github.com/weapp-vite/weapp-vite/commit/385f95b8979133346994e4b7e22e6dc58d4e30b7) by @sonofmagic

- 🐛 **修正自动路由默认扫描规则，不再把任意 `**/pages/**`目录视为页面目录，而是只默认扫描主包`pages/**`与已声明分包 root 下的`pages/**`，避免误匹配 `components/pages/**` 等非页面目录。** [`db9befb`](https://github.com/weapp-vite/weapp-vite/commit/db9befbe8865c2583f39c26449636c8cbe010749) by @sonofmagic

- 🐛 **优化 `weapp.tsconfigPaths` 在 Vite 8 下的默认行为：自动探测或显式传入 `true` 时，改为优先启用原生 `resolve.tsconfigPaths`，不再默认注入 `vite-tsconfig-paths` 插件，从而避免构建时出现对应的提示信息。仅当传入对象形式的高级选项时，才继续回退到 `vite-tsconfig-paths` 以兼容多 `tsconfig`、`exclude` 等定制能力。** [`8d008fb`](https://github.com/weapp-vite/weapp-vite/commit/8d008fb07c25b638c03659517f3efc5a9efacb47) by @sonofmagic

- 🐛 **扩展 `weapp.autoRoutes` 配置，除了继续支持 `boolean` 快速开关外，也支持传入对象进行细粒度控制，可分别配置 `enabled`、`typedRouter`、`persistentCache` 和 `watch`，以便按项目需要调整自动路由的类型输出、持久缓存与开发期监听行为。** [`25cfee0`](https://github.com/weapp-vite/weapp-vite/commit/25cfee0384a1049d4cfb236deed90446199510e6) by @sonofmagic

- 🐛 **调整 `wevu/router` 的创建与获取语义：新增 `createRouter()` 作为显式创建入口，`useRouter()` 只负责获取已创建的 router 实例，不再承担创建职责。同步更新相关测试与文档说明，推荐在应用入口或上层 `setup()` 中先调用 `createRouter()`，后续业务代码再通过 `useRouter()` 读取当前实例。** [`efdf1ee`](https://github.com/weapp-vite/weapp-vite/commit/efdf1ee19ef0d4d76db02468ed083355c69082d7) by @sonofmagic

- 🐛 **将 `weapp.autoRoutes.persistentCache` 的默认值调整为关闭。显式开启 `autoRoutes: true` 或对象配置后，不再默认生成 `.weapp-vite/auto-routes.cache.json`；只有在明确设置 `persistentCache: true` 时才会写入持久化缓存文件，减少仓库和示例应用中的本地状态产物。** [`871fba6`](https://github.com/weapp-vite/weapp-vite/commit/871fba60c48df171bb597294abd65ab58af6b3c8) by @sonofmagic

- 🐛 **默认开启 `weapp.autoRoutes`，并同步优化自动路由的初始化与增量扫描性能：仅在真正加载自动路由模块时才触发扫描与监听，优先遍历 `pages` 目录收集候选页面，同时增加基于文件时间戳的持久化缓存，减少冷启动和无变更场景下的重复全量扫描开销。** [`5c90833`](https://github.com/weapp-vite/weapp-vite/commit/5c90833970fe25c03efa254df31afa62b48e73d9) by @sonofmagic

- 🐛 **统一脚手架模板与仓库模板的忽略规则，默认忽略项目根目录下 `.weapp-vite/` 中的所有内容，为后续沉淀更多本地构建缓存和工具状态文件预留稳定目录约定，避免生成项目后误提交内部缓存产物。** [`2eee335`](https://github.com/weapp-vite/weapp-vite/commit/2eee33515a759635285e34104912558556551690) by @sonofmagic

## 2.0.47

### Patch Changes

- 🐛 **将 `rolldown-require` 的 `rolldown` peer 依赖最低版本提升到 `1.0.0-rc.9`，并为 `weapp-vite` 增加安装时的真实 rolldown 版本检查与运行时版本判断修复，避免工作区继续解析旧的 `1.0.0-rc.3`，同时同步 `create-weapp-vite` 的模板依赖目录版本。** [`88b2d31`](https://github.com/weapp-vite/weapp-vite/commit/88b2d316fe1238ea928abf7d63d0cb63ae29e1e8) by @sonofmagic

- 🐛 **为 `weapp-vite build` 增加主包与分包体积报告，并支持在包体积超过默认 2 MB 阈值时输出告警，便于在构建结束后直接发现包体积风险。** [`96f8e8e`](https://github.com/weapp-vite/weapp-vite/commit/96f8e8e0976eb6546025ad16162dccdbccd0e50a) by @sonofmagic

## 2.0.46

### Patch Changes

- 🐛 **修复零售模板的 Volar 模板类型推断配置。`weapp-vite-wevu-tailwindcss-tdesign-retail-template` 不再禁用模板 codegen，并为 `ui-address-item` 里的 `phoneReg` WXS 模块补充纯类型兜底声明；这样即使编辑器侧的 Volar WXS 注入未及时生效，也不会再错误提示 `phoneReg` 不存在于组件实例类型上。** [`183f1f2`](https://github.com/weapp-vite/weapp-vite/commit/183f1f2df9be325e2c43c7f152e4c9513e9530b2) by @sonofmagic

- 🐛 **修复分包 npm 依赖配置在构建阶段污染 `app.json` 的问题。现在 `weapp.npm.subPackages.<root>.dependencies` 与分包 `inlineConfig` 只会保留在内部构建元数据里，不会再被写回最终产物的 `subPackages` / `subpackages` 节点，从而避免生成包含无效字段的 `app.json`；同时补充单测与构建回归断言，继续覆盖 issue #327 相关的分包 npm 输出场景。** [`f141121`](https://github.com/weapp-vite/weapp-vite/commit/f141121d63b9c02172f551ffcfb5ca6e55ce7d80) by @sonofmagic

## 2.0.45

### Patch Changes

- 🐛 **跟随 weapp-vite 自动路由 HMR 修复进行版本同步。** [`b127b5e`](https://github.com/weapp-vite/weapp-vite/commit/b127b5e0e54f223f6e019ece85c99a09e6862cab) by @sonofmagic

- 🐛 **修复 issue #320 e2e 测试页面中 `addRoute` 同名替换验证逻辑：将 `path`（不含前导斜杠）改为 `fullPath`（含前导斜杠）进行路径比较，确保运行时断言与 e2e 测试期望值一致。同时新增 `addRoute` 同名替换的单元测试，覆盖 alias/redirect 替换、旧 alias 清理等场景。** [`7dda40a`](https://github.com/weapp-vite/weapp-vite/commit/7dda40a4f4a9f0f5e76cfdd3a81bf2fbd5c3a163) by @sonofmagic

- 🐛 **修复 issue #327：补齐 `weapp.npm.mainPackage.dependencies` 与 `weapp.npm.subPackages.<root>.dependencies` 在分包场景下的依赖分配能力。现在可以显式让主包不输出 `miniprogram_npm`，再按分包根目录分别声明应落入各自分包的 npm 依赖，避免依赖串包或主包残留产物；同时补上主包禁用 npm 输出时的缓存兜底逻辑，即使缓存标记未失效但缓存目录已经不存在，也会自动重新构建分包依赖，避免构建阶段因为缺失缓存目录而直接报错。此次改动同步补充了对应单测与 `github-issues` e2e 回归用例。** [#329](https://github.com/weapp-vite/weapp-vite/pull/329) by @sonofmagic

- 🐛 **修复 issue #328 中 `<script setup>` 首帧数据与子组件 prop 同步过晚的问题：编译产物现在会为可静态推导的 setup 初始值注入首帧 `data`，运行时注册阶段也会把这些初始数据同步保留到原生组件/页面定义中，避免父级 `ref('111')` 在首屏绑定到子组件 `String` prop 时先落成 `null` 并触发小程序类型 warning。同时补充 `github-issues` 的 issue-328 构建与 IDE 端到端回归用例，以及相关运行时/编译单测。** [`62619d9`](https://github.com/weapp-vite/weapp-vite/commit/62619d9b6b3e71afb99dc44bde51d6b0cfa1e322) by @sonofmagic

- 🐛 **修复 `defineComponent` 在未提供 `setup` 时仍然注册内部 `setupWrapper` 的问题，避免与首屏同步快照逻辑叠加后，在组件 `attached` 阶段同步多触发一次 `setData`。这样可以恢复无 `setup` 组件的挂载时序稳定性，消除合并 `main` 后在 CI 中出现的 `__wvOwnerId` 额外同步回归。** [#329](https://github.com/weapp-vite/weapp-vite/pull/329) by @sonofmagic

- 🐛 **为 `weapp-vite` 的 npm 构建新增更直观的依赖范围配置：现在可以通过 `weapp.npm.mainPackage.dependencies` 明确控制主包 `miniprogram_npm` 的输出范围，再通过 `weapp.npm.subPackages.<root>.dependencies` 显式声明各分包自己的 npm 依赖集合，让主包和分包的 npm 构建目标一眼可见，也为后续扩展主包 npm 自定义配置预留出清晰结构。此次改动同时补齐了依赖范围变更时的缓存失效与输出目录清理，避免旧的主包或分包 `miniprogram_npm` 残留；普通分包的本地 npm 输出也不再依赖额外实验开关，只要声明 `weapp.npm.subPackages.<root>.dependencies`，就会生成对应分包的 `miniprogram_npm`，并把分包内的 JS `require` 与 JSON `usingComponents` 路径本地化到该分包目录。** [#329](https://github.com/weapp-vite/weapp-vite/pull/329) by @sonofmagic

- 🐛 **升级 `weapp-vite` 的构建链路依赖版本，包含 `rolldown`、`oxc-parser`、`@oxc-project/types` 与 `cac`，并同步更新 `create-weapp-vite` 模板 catalog 中的 `vite`、`vue`、`@vue/compiler-core`、`@types/node` 等依赖版本，使脚手架生成项目与当前工具链版本保持一致。** [`46c34e3`](https://github.com/weapp-vite/weapp-vite/commit/46c34e3ef3ff70f4162601b63825395d662cfec1) by @sonofmagic

- 🐛 **为 weapp-vite 创建的 Vite 实例注入 `config.weappVite` 宿主元信息，并提供配套的检测 helper。这样用户自定义的 Vite 插件可以在 `config` 与 `configResolved` 阶段可靠判断自己当前是运行在 weapp-vite 中，还是普通 Vite 中，同时还能区分 `miniprogram` 与 `web` 两种 weapp-vite 运行面。** [`ae7fb25`](https://github.com/weapp-vite/weapp-vite/commit/ae7fb25d0a557bbb15653ffff684f580c6a6feb4) by @sonofmagic

## 2.0.44

### Patch Changes

- 🐛 **整合仅影响 weapp-vite 与 create-weapp-vite 的 changeset。** [`3449921`](https://github.com/weapp-vite/weapp-vite/commit/3449921ee8d3ff327ccbbad114ad1984a858781e) by @sonofmagic

  ## 变更摘要
  1. **late-clocks-promise.md**：新增 `weapp.wevu.autoSetDataPick` 编译期开关。开启后会从模板表达式自动提取渲染相关顶层 key，并注入到页面/组件的 `setData.pick`，用于减少非渲染字段参与快照与下发；同时兼容已有 `setData.pick` 配置并进行去重合并。
  2. **six-rivers-cheer.md**：为 weapp-vite 新增 `onPageScroll` 静态性能诊断：在页面脚本编译阶段自动扫描 `onPageScroll` 回调，针对空回调、`setData` 调用以及 `wx.*Sync` 同步 API 调用输出构建期告警，帮助在开发阶段提前发现滚动卡顿风险。 诊断同时接入 wevu 页面特性注入链路与 Vue/JSX transform 链路，并补充对应单测覆盖，确保告警行为稳定且不影响既有注入逻辑。

- 🐛 **整合同时影响 weapp-vite、wevu 与 create-weapp-vite 的 changeset。** [`3449921`](https://github.com/weapp-vite/weapp-vite/commit/3449921ee8d3ff327ccbbad114ad1984a858781e) by @sonofmagic

  ## 变更摘要
  1. **eager-crews-cough.md**：为 `weapp-vite` 新增 `weapp.wevu.preset: 'performance'` 预设，并将 `autoSetDataPick` 与预设联动（可被显式布尔配置覆盖）；同时为 `wevu` 增加 `setData.highFrequencyWarning` 开发态高频调用告警能力（默认关闭，可按阈值开启与调优）。此外同步补充 website 配置与 runtime 文档，明确预设内容、覆盖规则与 FAQ。
  2. **odd-horns-repeat.md**：为 `wevu` 新增 `useUpdatePerformanceListener()` 组合式 API：可在 `setup()` 中注册 `setUpdatePerformanceListener`，并在 `onUnload/onDetached` 自动清理，返回 `stop` 句柄支持手动停止；同时补齐 `SetupContextNativeInstance` 的对应类型桥接与导出覆盖测试。 同时增强 `weapp-vite` 的 `weapp.wevu.preset: 'performance'` 默认值：在保留 `patch + suspendWhenHidden + highFrequencyWarning` 的基础上，默认追加 `diagnostics: 'fallback'`，便于开发态更快定位 `setData` 回退与体积问题，并补齐相关单测与配置注释。
  3. **quiet-donuts-wave.md**：修复 `wevu` 的 `props -> properties` 归一化能力缺口：新增对 `optionalTypes` 与 `observer` 的透传，数组类型会规范化为 `type + optionalTypes`，并在缺失 `type` 时回填 `null` 以贴近小程序 `properties` 语义。同时修复 `weapp-vite` 自动组件元数据提取逻辑，`json.properties` 现在会合并 `type` 与 `optionalTypes` 生成联合类型，避免 typed-components/html custom data 类型信息偏窄。
  4. **rich-foxes-walk.md**：为 `wevu` 新增 `useRouter()` 与 `usePageRouter()`：在 `setup()` 中可直接获取小程序 Router，并优先保持 `this.router / this.pageRouter` 的原生语义。针对基础库低于 `2.16.1` 或实例路由器缺失场景，运行时会自动回退到全局 `wx` 同名路由方法；同时补齐 `SetupContextNativeInstance` 的 `router/pageRouter` 类型声明，并引入可声明合并的 `WevuTypedRouterRouteMap`，支持按项目路由清单收窄 `url` 类型。 `weapp-vite` 的自动路由产物 `typed-router.d.ts` 现已自动注入对 `wevu` 的模块增强：当启用 `autoRoutes` 后，`useRouter()/usePageRouter()` 的 `navigateTo/redirectTo/reLaunch/switchTab` 会继承 `AutoRoutesEntries` 联合类型（并保留相对路径写法），降低路由字符串拼写错误风险。同时 `weapp-vite/auto-routes` 新增 `wxRouter` 导出，提供一组代理到全局路由 API 的类型化方法，便于在业务代码中直接获得路由参数约束。

- 🐛 **整合 wevu 路由与运行时能力增强相关 changeset。** [`3449921`](https://github.com/weapp-vite/weapp-vite/commit/3449921ee8d3ff327ccbbad114ad1984a858781e) by @sonofmagic

  ## 变更摘要
  1. **blue-apples-jump.md**：对齐 `wevu/router` 的导航钩子调用心智：`beforeEach` / `beforeResolve` 统一支持 `(to, from, context?)`，`afterEach` 支持 `(to, from, failure?, context?)`，让默认使用方式与 Vue Router 更一致，同时保留 `context` 作为高级扩展参数。
  2. **blue-halls-listen.md**：为 `wevu` 新增 `usePageScrollThrottle()` 组合式 API：可在 `setup()` 中直接注册节流版 `onPageScroll` 回调，支持 `interval`、`leading`、`trailing` 选项，并返回 `stop` 句柄用于手动停止监听。 该能力会在 `onUnload/onDetached` 自动清理挂起的 trailing 定时器，避免页面销毁后残留滚动任务；同时补齐运行时导出覆盖与类型测试，确保 API 可用性与类型推导稳定。
  3. **bright-falcons-cheer.md**：为 `wevu/router` 增加 `onError()` 订阅能力，用于集中处理路由守卫抛错等异常型导航失败；同时保留 `afterEach` 对所有导航结果的统一收敛，减少 duplicated/cancel 等预期失败对异常监控的干扰。
  4. **calm-pets-fry.md**：在 `wevu/router` 中新增对齐 Vue Router 心智的基础能力：`useRoute()` 当前路由快照、`resolveRouteLocation()` 路由归一化，以及 `parseQuery()` / `stringifyQuery()` 查询串工具，便于在小程序环境中统一路由解析与类型约束。
  5. **chilly-wasps-enjoy.md**：`wevu/router` 新增 `RouteRecordRaw.children` 声明支持。现在可以在 `namedRoutes` 中使用树状路由配置，运行时会自动展平成可匹配记录，并支持子路由的 `resolve`、路径反查（`name/params` 推断）以及 `beforeEnter/redirect` 执行链路。同时，`children` 命中场景下 `resolve().matched` 会返回父到子的匹配链，`resolve().meta` 按父到子顺序进行浅合并，更贴近 Vue Router 心智模型。
  6. **cold-apricots-impress.md**：`wevu/router` 新增 `router.install(app?)` 兼容方法（no-op），用于提升与 Vue Router 插件调用形态的一致性，便于跨端共享代码时减少条件分支。该方法在小程序运行时不执行额外注册逻辑。
  7. **cool-needles-warn.md**：为 `wevu/router` 增加 `router.currentRoute` 只读引用，直接暴露当前路由状态并与 `onShow/onRouteDone` 等页面路由生命周期保持同步，进一步贴近 Vue Router 的使用心智；同步补充运行时与类型测试。
  8. **dirty-bees-work.md**：为 `wevu` 新增子路径入口 `wevu/router`，导出 `useRouter` / `usePageRouter` 及路由相关类型，便于按模块按需导入并统一路由类型约束。
  9. **early-olives-trade.md**：为 `wevu/router` 增加 `namedRoutes` 的运行时解析能力：支持 `{ name, params }` 在 `resolve/push/replace` 中映射到真实页面路径，并在静态路径命中时回填 `route.name`；同时对未配置路由名或缺失必填参数统一产出 `NavigationFailureType.unknown`（默认按 `rejectOnError` 拒绝），让命名导航行为更贴近 Vue Router 心智模型。
  10. **fair-hats-switch.md**：移除 `wevu/router` 中未发布的兼容别名 `useRouterNavigation`（以及 `UseRouterNavigationOptions`），将高阶导航入口统一收敛为 `useRouter()`，避免命名分叉带来的使用误解。
  11. **fair-spoons-visit.md**：完善 `wevu/router` 在嵌套路由场景下的 `alias` 语义：当父路由声明 `alias` 且子路由使用相对路径时，子路由会自动继承并展开父级 alias 路径，使 `resolve()`、路径匹配和守卫链在 alias 链路下保持一致。 同时补齐运行时 `addRoute(parentName, route)` 的行为一致性，确保动态注册的子路由同样继承父级 alias；并新增对应单测与对齐矩阵文档更新。
  12. **fast-eggs-try.md**：进一步增强 `wevu/router` 的导航管线：新增 `afterEach` 后置钩子（统一获取成功/失败上下文），并支持守卫返回 `{ to, replace }` 形式的重定向结果，让守卫可以显式控制重定向走 `push` 还是 `replace` 语义。
  13. **five-mangos-grab.md**：新增 `useIntersectionObserver()` 组合式 API：在 `setup()` 内可直接创建 `IntersectionObserver`，并在 `onUnload/onDetached` 时自动断开连接，降低手写清理逻辑与滚动轮询成本。同时增强 `setData.highFrequencyWarning`：在检测到 `onPageScroll` 回调中调用 `setData` 时输出专项告警（可配置冷却时间与开关），引导改用可见性观察或节流方案，并补充对应文档与类型定义。
  14. **funny-buses-whisper.md**：增强 `usePageScrollThrottle()`：新增 `maxWait` 选项，在持续滚动期间可限制“最长不触发时间”，避免仅依赖 `interval`/`trailing` 时长时间未回调。 同时补充 `maxWait` 相关边界测试与类型覆盖，确保 `leading`、`trailing`、`maxWait` 组合行为稳定，并保持卸载时定时器清理语义不变。
  15. **fuzzy-pigs-cheat.md**：为 `wevu` 新增子路径入口 `wevu/store` 与 `wevu/api`，其中 `wevu/api` 直接透传 `@wevu/api` 的能力，便于按需导入并保持与独立 API 包的一致接口。
  16. **good-pianos-juggle.md**：`wevu/router` 新增 `router.isReady()`，用于对齐 Vue Router 的可等待启动语义。在当前小程序运行时中该 Promise 会立即 resolve，便于统一业务层调用模式（例如在初始化流程中统一 `await router.isReady()`）。
  17. **green-bears-hear.md**：继续增强 `wevu/router`：新增 `beforeResolve` 守卫，并支持守卫返回重定向目标（字符串或路由对象）；同时为重定向链路加入 `maxRedirects` 上限控制，避免守卫循环重定向导致的无限导航。
  18. **green-cups-bow.md**：`wevu/router` 新增 `router.options` 只读配置快照，用于按 Vue Router 心智读取初始化参数（如 `paramsMode/maxRedirects/namedRoutes/tabBarEntries`）。该快照在路由器创建时确定，不会随着 `addRoute/removeRoute/clearRoutes` 的运行时变更而漂移，便于调试与诊断。
  19. **green-houses-smile.md**：为 `wevu` 的 `setData` 新增了两项运行时性能能力：`suspendWhenHidden` 用于页面/组件进入后台态后挂起并合并更新，在回到前台时再一次性下发；`diagnostics` 用于输出内建的 `setData` 诊断日志，便于定位高频更新、回退 diff 与 payload 体积问题，同时保持现有 `debug` 回调兼容。
  20. **green-lamps-brush.md**：`wevu/router` 新增 `routes` 兼容入口，用法与 Vue Router 更一致；同时保留 `namedRoutes` 作为兼容写法。初始化时支持同时传入 `routes` 与 `namedRoutes`，并约定同名记录由 `namedRoutes` 覆盖。 另外补齐 `router.options.routes` 快照输出、相关类型测试和文档示例，帮助业务逐步从旧写法迁移到 `routes` 心智。
  21. **green-zebras-think.md**：为 `wevu/router` 新增 `go(delta)` 与 `forward()` 导航方法：`go(<0)` 复用小程序 `navigateBack` 回退，`go(0)` 为无操作，`forward()` 在小程序路由能力受限场景下返回 `NavigationFailureType.aborted`。同时补充对应的运行时与类型测试，完善与 Vue Router 导航 API 的对齐体验。
  22. **itchy-points-begin.md**：为 `wevu/router` 增加 `paramsMode` 选项（`loose | strict`，默认 `loose`），用于控制命名路由 `params` 的容错行为：`strict` 模式下会校验并拒绝未被路径模板消费的多余参数，减少参数误传导致的隐性导航问题。同步补充运行时与类型测试覆盖。
  23. **late-poems-think.md**：`wevu/router` 调整 `removeRoute(name)` 在 `children` 场景下的行为：删除父路由时会连带删除其子路由记录，避免出现父路由已移除但子路由仍可匹配的状态偏差，更贴近 Vue Router 心智模型。
  24. **lazy-lions-film.md**：收敛 `wevu/router` 的 `router.options` 语义：现在会返回运行时冻结的初始化快照，避免业务侧误改配置导致的状态歧义。快照保持“初始化值”定位，不随 `addRoute/removeRoute/clearRoutes` 动态变化；动态路由状态请通过 `getRoutes()` 获取。 同时补充对应回归测试与文档说明，明确 `routes` 为推荐入口、`namedRoutes` 为兼容入口的迁移策略。
  25. **mighty-garlics-teach.md**：继续对齐 `wevu/router` 的 Vue Router 心智： - `useRouter` 新增 `parseQuery` / `stringifyQuery` 配置钩子，支持按实例自定义查询解析与序列化。 - 增加 hash-only 导航判定策略：当路径与查询等价、仅 `hash` 变化时返回 `aborted` 失败，避免在小程序原生路由层触发无效跳转。
  26. **neat-lions-swim.md**：补齐 `wevu/router` 的 `RouteLocation` 最小字段模型：新增 `hash` / `name` / `params`（含 `RouteParamsRaw` 归一化），并支持从 `fullPath` 解析 `hash`。为保持小程序兼容，原生 `navigateTo/redirectTo` 发送的 URL 会自动忽略 `hash`，仅在路由语义层保留该字段。
  27. **neat-pens-jam.md**：`wevu/router` 在 alias 命中场景下补充 `resolve().matched` 语义：保持 `matched.path` 为 canonical 路由路径，并在叶子记录上新增可选 `aliasPath` 字段标记实际命中的 alias 模板/路径，便于调试与埋点时区分“规范路径”与“alias 命中路径”。
  28. **neat-squids-dance.md**：收紧 `wevu/router` 初始化路由配置校验：当路由记录存在空 `name/path`、重复 `alias`（含与主路径相同）或循环 `children` 引用时，会输出告警并跳过无效部分，避免潜在的匹配歧义与递归风险。 同时补充回归测试，覆盖无效记录跳过、alias 归一化告警与循环引用处理，确保 `addRoute` 与初始化场景行为稳定。
  29. **odd-cups-beam.md**：`wevu/router` 新增 `addRoute(parentName, route)` 重载，支持以 Vue Router 心智将子路由动态挂载到已存在父路由下。子路由使用相对路径时会基于父路由路径自动拼接，并保持与 `removeRoute/hasRoute/getRoutes` 的一致行为。
  30. **old-emus-decide.md**：为 `wevu` 新增 `wevu/fetch` 子路径导出，基于 `@wevu/api` 的 `wpi.request` 提供与标准 `fetch` 对齐的核心行为：返回 `Promise<Response>`、HTTP 非 2xx 不抛错、网络失败抛 `TypeError`、支持 `AbortSignal` 取消、并对 `GET/HEAD` 携带 `body` 进行一致性校验。
  31. **olive-cameras-itch.md**：增强 `wevu/router` 的导航能力：`useRouterNavigation()` 新增 `beforeEach` 轻量守卫，并支持按 `tabBarEntries` 自动把 `push/replace` 分流到 `switchTab`，同时补充对应的失败判定与类型约束。
  32. **quick-cameras-wave.md**：`wevu/router` 完善 `children` 场景下的路由记录 `redirect` 执行语义：当目标命中父子匹配链时，会按匹配链优先处理父级 `redirect`。一旦命中重定向，后续子路由守卫将不再执行，行为更贴近 Vue Router 嵌套路由心智模型。
  33. **quiet-badgers-sparkle.md**：增强 `wevu/router` 的重名路由告警可读性：`routes` / `namedRoutes` 冲突时会输出来源与路径变化（例如 `routes:/old -> namedRoutes:/new`），帮助快速定位覆盖来源。 同时补齐动态路由替换的回归覆盖：`addRoute()` 同名替换后，验证 alias、beforeEnter、redirect、children 清理与静态匹配索引均按新记录生效，避免旧链路残留。
  34. **quiet-planes-check.md**：增强 `wevu/router` 的解析结果与路由记录行为：`resolve()` 结果新增 `href/matched/redirectedFrom` 扩展字段（可选），并在导航重定向链路中透出来源位置信息；同时补齐 `RouteRecordRaw` 子集能力的回归测试，覆盖 `meta` 注入、`beforeEnter` 与记录级 `redirect` 行为。
  35. **rare-brooms-argue.md**：为 `wevu` 新增 `onMemoryWarning()` App 生命周期能力：在 `setup()` 注册后，运行时会桥接 `wx.onMemoryWarning` 并在重复绑定时自动调用 `wx.offMemoryWarning` 清理旧监听，避免内存告警监听器累积。开发者可在回调中集中回收大缓存、临时对象与冗余订阅，同时补齐对应的类型定义、单测与 website 文档。
  36. **red-lamps-talk.md**：为 `wevu/router` 增加 `RouteRecordRaw` 子集能力（`meta`、`beforeEnter`、`redirect`），并将 `namedRoutes`、`getRoutes()`、`addRoute()` 升级到记录模型；导航流程新增路由记录级重定向与 `beforeEnter` 守卫执行，`resolve()` 可从命中记录注入 `meta`，进一步对齐 Vue Router 的路由心智模型。
  37. **rude-countries-yawn.md**：`wevu/router` 完善 `children` 场景下的 `beforeEnter` 执行语义：当目标命中父子链路时，`beforeEnter` 会按父到子顺序依次执行；若父级守卫返回重定向，后续子守卫将不再执行。该行为更贴近 Vue Router 的嵌套路由守卫心智模型。
  38. **silly-cobras-wave.md**：`wevu/router` 新增 `router.clearRoutes()`，用于一次性清空当前路由器实例中的命名路由记录（包含初始化和运行时动态添加的记录）。该能力与 `addRoute/removeRoute/getRoutes/hasRoute` 形成完整的路由记录管理闭环，便于迁移期重置路由表与测试隔离。
  39. **small-seas-knock.md**：调整 `wevu` 根入口的路由 helper 命名，移除易与 `wevu/router` 高阶导航混淆的 `useRouter()/usePageRouter()`，统一改为 `useNativeRouter()/useNativePageRouter()`；同时在注释中明确推荐优先使用 `wevu/router` 的 `useRouter()` 获取更完整的导航能力（守卫、失败分类与解析能力）。
  40. **sour-houses-listen.md**：为 `wevu/router` 增加运行时路由管理能力：新增 `addRoute()` 与 `removeRoute()`，并与 `hasRoute()/getRoutes()`、命名路由解析链路联动，使 `namedRoutes` 支持在运行时动态增删并立即生效。
  41. **swift-icons-fail.md**：进一步对齐 `wevu/router` 与 Vue Router 的导航 Promise 心智：默认情况下，守卫抛错等“异常型失败”会以 Promise reject 抛出；常规导航失败（如 duplicated/cancelled）仍通过返回值传递。新增 `UseRouterOptions.rejectOnError` 可关闭该行为，回退到始终返回失败对象的模式。
  42. **tall-bottles-push.md**：`wevu/router` 新增 `RouteRecordRaw.alias` 支持（字符串或字符串数组）。现在通过 alias 路径进行 `resolve/push/replace` 时，可以正确命中命名路由记录并推断 `name/params/matched`，同时会触发对应记录的 `beforeEnter/redirect` 逻辑。
  43. **tame-geese-taste.md**：进一步分层 `wevu/router` 的路由配置校验策略：初始化阶段对无效记录采用“告警并跳过”（空 `name/path`、重复/无效 `alias`、循环 `children` 引用）；运行时 `addRoute()` 对根记录采用“失败即抛错”（缺失 `name/path` 或循环引用直接抛错）。 同时补充对应回归测试与文档说明，明确初始化与动态注册两条链路的容错等级，减少迁移期配置歧义。
  44. **tidy-bottles-joke.md**：收紧 `wevu` 路由类型：`switchTab` 现在使用仅绝对路径的独立类型约束，并支持通过 `WevuTypedRouterRouteMap.tabBarEntries` 进一步收窄为 tabBar 页面联合类型；未声明时回退到 `entries`。同时补充对应的类型测试与文档说明，明确 `switchTab` 不接受相对路径和查询参数。 同时修复一组运行时类型声明细节，消除 `wevu` 类型检查中的基线噪音：避免根导出里的重复 `ModelRef` 导出冲突，收敛 `setData` 适配器返回类型，并补齐若干严格模式下的显式类型注解。 另外补强 `createWevuComponent()` 的泛型推导，使其 `props` 写法在类型层与 `defineComponent()` 保持一致，并补充对应 `test-d` 断言。
  45. **tiny-countries-listen.md**：修复 `wevu/router` 的动态路径匹配能力：当通过路径形式导航到动态命名路由（如 `/pages/post/42/index`）时，现在可以正确推断路由记录并注入 `name/params/matched`，同时会触发对应记录的 `beforeEnter/redirect` 逻辑。
  46. **tough-rice-wave.md**：增强 `wevu/router` 的路由配置可观测性与重名处理语义：初始化时若 `routes` 与 `namedRoutes`（或同一来源）存在同名路由，会输出告警并明确“后者覆盖前者”。 同时调整 `addRoute()` 的重名行为：新增同名路由时会先清理旧路由及其 `children` 链，再写入新记录，避免旧路径/旧子路由残留造成匹配歧义。并补充覆盖守卫、重定向、静态路径索引和 children 清理的回归测试与文档说明。
  47. **twelve-turtles-tickle.md**：在 `wevu/router` 中补充 Vue Router 风格的导航封装能力：新增 `useRouterNavigation()`（`push/replace/back/resolve`）、`NavigationFailureType`、`createNavigationFailure()` 与 `isNavigationFailure()`，用于统一处理小程序路由调用结果与失败分类。
  48. **wild-peaches-smell.md**：调整 `wevu/router` 的命名心智：将高阶导航入口统一为 `useRouter()`，并新增 `useNativeRouter()` / `useNativePageRouter()` 表达原生路由桥接语义；同时保留 `useRouterNavigation()` 作为兼容别名，便于渐进迁移。
  49. **wise-buses-jam.md**：为 `wevu/router` 新增 `hasRoute(name)` 与 `getRoutes()`，用于在运行时检查和读取 `namedRoutes` 映射；同时补齐命名路由在守卫重定向场景下的测试覆盖，确保 `{ name, params }` 目标可被一致解析并导航。
  50. **young-pears-glow.md**：为 `wevu` 新增 `useDisposables()` 组合式清理工具：在 `setup()` 中可统一注册清理函数或带 `dispose/abort/cancel/stop/disconnect/destroy/close` 方法的对象，并在 `onUnload/onDetached` 自动批量释放，支持幂等 `dispose()` 与取消注册。 同时提供 `bag.setTimeout()` / `bag.setInterval()` 计时器辅助，自动在销毁时清理 timer，减少页面与组件长期运行下的内存泄漏风险；并补齐导出覆盖、类型测试与运行时单测。

- 🐛 **修复 `autoRoutes` 生成路由类型在 `defineAppJson` 场景下的 `subPackages` 类型兼容性问题：为 `AutoRoutesSubPackage` 增加字符串索引签名，并在 `typed-router.d.ts` 生成的分包对象字面量中同步注入 `[k: string]: unknown`。修复后，`routes.subPackages` 可直接用于 `defineAppJson({ subPackages })`，避免 `vue-tsc` 报告 TS2769 类型不匹配错误。** [#325](https://github.com/weapp-vite/weapp-vite/pull/325) by @sonofmagic

- 🐛 **修复 `autoRoutes` 生成的 `typed-router.d.ts` 在声明 `wevu/router` 时未先导入原模块的问题。此前 TypeScript 可能将其当作独立模块声明，导致 `useRouter` 等已导出成员在编辑器中被错误标记为不存在。现在生成文件会先 `import 'wevu/router'` 再做模块增强，确保路由类型扩展与原有导出可同时生效，并补充相应测试防回归。** [`0c5fec9`](https://github.com/weapp-vite/weapp-vite/commit/0c5fec972e3f659a19600610b35f31c5a9207f57) by @sonofmagic

## 2.0.43

### Patch Changes

- 🐛 **进一步优化小程序动态导入构建链路：在预处理阶段同时移除 `vite:build-import-analysis` 与 `native:import-analysis-build`，避免在小程序产物中注入 `__vitePreload` 包装逻辑。动态导入将直接输出为小程序可用的 `Promise.resolve().then(() => require(...))` 形式，减少运行时代码并规避浏览器预加载分支的潜在兼容性噪音。** [`98906c7`](https://github.com/weapp-vite/weapp-vite/commit/98906c7d418e4ae04173ad33e40bab07dac00ccb) by @sonofmagic

- 🐛 **修复小程序构建中动态导入预加载辅助代码导致的 `__VITE_IS_MODERN__ is not defined` 问题。现在在小程序配置合并阶段默认关闭 `build.modulePreload`，避免注入不适用于小程序运行时的预加载逻辑；若用户显式配置 `build.modulePreload`，仍保持用户配置优先。** [`2201c68`](https://github.com/weapp-vite/weapp-vite/commit/2201c689d263579bda25f5baefb2bfa25ed6c4cf) by @sonofmagic

## 2.0.42

### Patch Changes

- 🐛 **修复 duplicate 分包共享 chunk 在 importer 识别阶段误判自身为主包引用的问题，避免错误回退到主包后出现 `common.js` 自引用与 `rolldown-runtime.js` 相对路径异常。同时补充 issue #317 的单元与 e2e 回归覆盖，确保双分包共享模块产物稳定落在各自分包目录。** [`4dde4fd`](https://github.com/weapp-vite/weapp-vite/commit/4dde4fdfff0a6416e07fef81348bbc30187500a2) by @sonofmagic

- 🐛 **为 `weapp.mcp.autoStart` 的自动启动日志补充了接近 Vite 风格的地址输出（`➜ URL`），便于在终端快速识别 MCP 服务入口；并将自动启动触发范围收敛到开发命令（`dev/serve` 与默认开发启动）。同时新增 `apps/mcp-demo` 的自动启动配置，使执行 `pnpm dev` 时可自动拉起 `http://127.0.0.1:3188/mcp`。** [`25e9cc2`](https://github.com/weapp-vite/weapp-vite/commit/25e9cc2b2c865e9a39f7515a24d8015abf5bba44) by @sonofmagic

- 🐛 **修复小程序模板编译时 kebab-case 自定义事件的绑定属性生成规则：`@overlay-click` 现在会输出 `bind:overlay-click`（以及 `catch:overlay-click`），不再错误输出 `bindoverlay-click`。同时补充 issue #316 的单元与 e2e 回归覆盖，确保构建产物和 DevTools 运行时都能正确触发事件。** [`41b049f`](https://github.com/weapp-vite/weapp-vite/commit/41b049f6bca3cd870343dd5b515597075e0c1686) by @sonofmagic

## 2.0.41

### Patch Changes

- 🐛 **修复在 `setup()` 返回 `getCurrentSetupContext()` 时可能进入 `setData` 快照并触发递归爆栈的问题，同时补充对应回归测试，并将 composition api 的 weapp e2e 用例拆分为可单独执行的页面级 case。** [`8b76120`](https://github.com/weapp-vite/weapp-vite/commit/8b761206940c4e99c1f65b3663898660f448714d) by @sonofmagic

- 🐛 **本次变更主要修复了三类一致性与可维护性问题：一是 `wevu` 构建默认产物此前仅压缩且缺少 sourcemap，不利于排查线上问题，现调整为输出 sourcemap 以提升调试可观测性；二是 `weapp-vite` 侧 `oxc-parser` 与类型依赖升级到同一版本，降低 AST 解析与类型不匹配带来的潜在风险；三是同步更新 workspace catalog 与 `create-weapp-vite` 生成 catalog，避免模板初始化时依赖版本与仓库主线不一致。** [`17f30b1`](https://github.com/weapp-vite/weapp-vite/commit/17f30b169337d5bc015a46841807f964cc1e140f) by @sonofmagic

- 🐛 **修复 `@wevu/compiler` 在 `defineOptions` 与组件事件内联表达式组合场景下的注入缺陷：当组件选项通过 spread 合并且 `methods` 来自 spread 对象时，内联事件映射会新增同名 `methods` 键导致原方法被覆盖，进而在模板中触发 `@change="onChange"` 时出现 `onChange is not a function`。本次调整为按 spread 来源合并 `methods` 后再注入 `__weapp_vite_inline_map`，并恢复零售模板 tabbar 使用标准 Vue 事件写法，避免运行时方法丢失。** [`662630e`](https://github.com/weapp-vite/weapp-vite/commit/662630e7c12e49bf783d7e728618fbbad863ff3b) by @sonofmagic

- 🐛 **统一调整 `weapp-vite-wevu-tailwindcss-tdesign-retail-template` 的 wevu 组件默认样式隔离配置为 `apply-shared`，使组件能够继承 `src/app.vue` 中的全局样式（如 Tailwind 基础样式与全局工具类），减少组件样式隔离导致的全局样式失效问题。** [`00795fc`](https://github.com/weapp-vite/weapp-vite/commit/00795fc409abcc98ea50a607f0f228215faedeb3) by @sonofmagic

- 🐛 **继续收敛 `weapp-vite-wevu-tailwindcss-tdesign-retail-template` 的类型与静态检查问题：移除模板 `src` 中的 `@ts-nocheck`，补齐 mock 工具与服务/模型函数签名，修复订单与优惠券相关类型不一致及重复字段定义，确保模板在默认配置下稳定通过 `typecheck`、`eslint` 与 `build`。** [`0f45e72`](https://github.com/weapp-vite/weapp-vite/commit/0f45e7265589e63472b73834e1f6fd91cf4134a9) by @sonofmagic

- 🐛 **修复了 `defineOptions` 静态内联在模板项目中的编译问题：当配置对象中包含对象方法写法（如 `data() {}`）或内置构造器类型（如 `String`/`Number`）时，之前可能被错误序列化为不可解析代码或被误判为不支持的原生函数。此次同时收敛了 defineOptions 依赖提取范围，避免仅在方法体中使用的模块被提前求值导致构建失败。并同步保留零售模板的 TypeScript 路径映射配置，确保模板工程一致性。** [`8184b9f`](https://github.com/weapp-vite/weapp-vite/commit/8184b9f12b9aafb18292516cb03102db074c9c43) by @sonofmagic

- 🐛 **修复 `weapp-vite` 包内多处 TypeScript 类型问题，并收敛包级 `tsc` 检查范围到发布源码：** [`3740446`](https://github.com/weapp-vite/weapp-vite/commit/3740446500162e10495ed087e8c6f5c89bbd0f85) by @sonofmagic
  - 修正 npm 打包器中 Babel 导出节点与支付宝 npm 模式的类型不匹配；
  - 修正路由监听事件分支、lib 入口类型回退、作用域插槽平台配置空值判断与共享构建输出回调参数类型；
  - 修正自动导入产物同步时 `outputPath` 缩窄后的可空类型告警；
  - `packages/weapp-vite/tsconfig.json` 排除 `*.test.ts` 与 `test/`，避免测试夹具类型噪音干扰包级 typecheck。

- 🐛 **清理 `weapp-vite-wevu-tailwindcss-tdesign-retail-template` 中 `useNativeInstance()` 的 `as any` 断言，统一使用默认推断类型调用，减少模板示例中的宽泛类型逃逸，便于后续按运行时 API 做精确类型收敛与维护。** [`8313ac5`](https://github.com/weapp-vite/weapp-vite/commit/8313ac52cd0bcd51b04838b0e8fce0b408b29e99) by @sonofmagic

- 🐛 **修复 `weapp-vite-wevu-tailwindcss-tdesign-retail-template` 首页相关组件在异步回调中调用 `useNativeInstance()` 导致的运行时错误。将 `useNativeInstance()` 收敛到 `setup()` 同步阶段调用，并在后续异步逻辑中复用实例，避免出现 “必须在 setup() 的同步阶段调用” 异常，提升模板初始化与页面渲染稳定性。** [`4a0f1b6`](https://github.com/weapp-vite/weapp-vite/commit/4a0f1b6ef09edd902afb44566b8a16f4c7749449) by @sonofmagic

- 🐛 **清理并收敛 `weapp-vite-wevu-tailwindcss-tdesign-retail-template` 模板源码中的 TypeScript 与 ESLint 问题：统一模板内 Vue SFC 书写形态、修正一批服务层导入与类型冲突、补齐兼容性配置以保证模板在默认环境下可稳定通过 `typecheck`、`eslint` 与 `build`，降低初始化后首次二次开发的错误成本。** [`9ea6d78`](https://github.com/weapp-vite/weapp-vite/commit/9ea6d7873a9027d88760eb65d26183c1fd2c2328) by @sonofmagic

- 🐛 **调整 npm 构建默认压缩策略：`weapp-vite` 的 npm 打包产物默认不再压缩（`build.minify` 默认值从 `true` 改为 `false`），以便在小程序端更容易排查依赖代码问题。若有体积优化需求，仍可通过 `weapp.npm.buildOptions` 显式覆盖为 `minify: true`。** [`e621560`](https://github.com/weapp-vite/weapp-vite/commit/e6215606f17d67a8f6f524c963d35531f184d94e) by @sonofmagic

- 🐛 **修复 npm 重打包场景 sourcemap 错位问题：对于会被 `weapp-vite` 二次打包的普通依赖，不再复制上游入口自带的 sourcemap 到 `miniprogram_npm`，避免出现 `index.js` 与 `index.js.map` 映射不一致。若需要调试 map，应通过 `weapp.npm.buildOptions` 为最终产物显式开启 `build.sourcemap` 生成。** [`e065c65`](https://github.com/weapp-vite/weapp-vite/commit/e065c6579defdb89a81231b97847d2f09c02d0e1) by @sonofmagic

## 2.0.40

### Patch Changes

- 🐛 **在 `weapp-vite` 中集成 `@weapp-vite/mcp`：新增 `weapp-vite mcp` CLI 命令用于直接启动 MCP stdio 服务，新增 `weapp-vite/mcp` 程序化导出入口，并补充详细的 MCP 使用文档（启动方式、客户端接入、工具与资源说明、安全边界与排障）。** [`2530a6f`](https://github.com/weapp-vite/weapp-vite/commit/2530a6fb262d106cdfefdd9a36062e9030400f05) by @sonofmagic

- 🐛 **为 `weapp-vite` 增加 MCP 自动启动能力并调整默认策略：新增 `weapp.mcp` 配置，默认不自动拉起 MCP 服务（可通过 `autoStart: true` 开启）；同时扩展 `weapp-vite mcp` 命令支持 `streamable-http` 启动参数（host/port/endpoint）。** [`d8050a9`](https://github.com/weapp-vite/weapp-vite/commit/d8050a967743cfa70b7c818ac6fb726a86697282) by @sonofmagic

- 🐛 **修复 `weapp-vite/auto-routes` 在页面运行时代码中被别名解析到源码入口时可能触发 Rolldown 崩溃的问题。现在无论通过包名还是别名路径导入，都会统一走 auto-routes 虚拟模块；同时补充相关单测与 `auto-routes-define-app-json` 运行时 e2e 覆盖，确保首页导航链接可稳定渲染。** [`4912425`](https://github.com/weapp-vite/weapp-vite/commit/491242587cd1c15c9fba68eb2b3ec6bcb34b6269) by @sonofmagic

## 2.0.39

### Patch Changes

- 🐛 **修复 auto-routes 在开发模式下对新增页面与目录变更的热更新同步问题：补齐 pages 相关路径变更的兜底重扫逻辑，并修正全量重扫时的候选扫描范围，避免 typed-router 与构建产物在增删改场景下出现漏更新。同步新增并加固 auto-routes HMR 的 e2e 覆盖，验证新增、删除、修改、重建等核心路径。** [`f0dda62`](https://github.com/weapp-vite/weapp-vite/commit/f0dda629ebd785aba358483bae7eeab228102206) by @sonofmagic

- 🐛 **修复 `app.vue` 中 `<script setup>` 的 `defineOptions` 不能引用局部变量或导入变量的问题，并统一增强宏配置提取体验：** [`a1ae4a6`](https://github.com/weapp-vite/weapp-vite/commit/a1ae4a6abe0374644a32d0078085bd662faae641) by @sonofmagic
  - 新增 `defineOptions` 参数静态内联能力，支持引用本地声明与跨文件导入（包含 `weapp-vite/auto-routes` 顶部静态引入场景）。
  - `auto-routes-define-app-json` 示例改为单 `script setup`，同一份 `routes` 同时用于 `defineAppJson` 与运行时 `globalData`。
  - 补充单元测试与 e2e 测试，覆盖 JSON 宏和 `defineOptions` 对局部/导入变量的兼容性与热更新回归。

## 2.0.38

### Patch Changes

- 🐛 **增强 `weapp-vite` CLI 对 `weapp-ide-cli` 的能力复用：现在可直接在 `weapp-vite` 中调用 `preview`、`upload`、`config`、automator 等命令，并新增 `weapp-vite ide <args...>` 命名空间透传入口，方便在脚本与 CI 中统一命令入口。** [`648e2ba`](https://github.com/weapp-vite/weapp-vite/commit/648e2ba893373dc04ac45cc627ca260cfaa9d9a6) by @sonofmagic

- 🐛 **修复 `wevu` 在小程序运行时 `setData` 快照与下发 payload 的引用污染问题：当 `computed` 返回对象并在模板读取其属性时，切换到其他引用再切回初始引用会被错误判定为未变化。现在会在内部快照与 `setData` 下发前做隔离拷贝，确保 `option.label` 这类绑定在引用往返后仍能正确更新。** [`da5b206`](https://github.com/weapp-vite/weapp-vite/commit/da5b20637dda06f67207f36952ef4115005456dd) by @sonofmagic

- 🐛 **在 `weapp-ide-cli` 中整理并导出了完整命令目录（官方 CLI、automator、config、minidev），新增 `isWeappIdeTopLevelCommand` 判断函数。`weapp-vite` 的 IDE 透传逻辑改为基于该目录判断，仅在命令未被 `weapp-vite` 自身注册且命中 `weapp-ide-cli` 命令目录时才透传执行。** [`83a3e18`](https://github.com/weapp-vite/weapp-vite/commit/83a3e18c07bf9780e1b012a106f217af51cd2123) by @sonofmagic

## 2.0.37

### Patch Changes

- 🐛 **修复 issue #309 的页面生命周期边界场景：页面未声明 `onPullDownRefresh` 或使用 `setupLifecycle: 'created'` 时，`onLoad` 仍会稳定触发，同时避免编译阶段重复注入 `__wevu_isPage`。补充对应单元测试与 e2e 用例，防止后续回归。** [`39227de`](https://github.com/weapp-vite/weapp-vite/commit/39227de97e3d6e4e1f82b14a6ce5e8bce918b0d9) by @sonofmagic

## 2.0.36

### Patch Changes

- 🐛 **修复 `wevu` 组件侧 `pageLifetimes.routeDone` 的生命周期桥接，确保在组件中可通过 `onRouteDone` 正常接收页面路由动画完成事件；同步补齐相关运行时测试与文档映射说明（`lifetimes/pageLifetimes` 与组合式 API 的对应关系），避免与微信官方生命周期定义不一致。** [`6742994`](https://github.com/weapp-vite/weapp-vite/commit/6742994ffd0a3c522d1e527e0d90e4863a2d853c) by @sonofmagic

- 🐛 **优化 Wevu API 文档的公开边界：移除 API 页面中不应面向业务侧展示的内部接口，并在运行时源码中为内部能力补充 `@internal` 标注；同时将 `provideGlobal` / `injectGlobal` 标记为 `@deprecated`（保留导出用于兼容过渡），统一文档与实际导出语义，降低误用内部能力的风险。** [`c7f37ac`](https://github.com/weapp-vite/weapp-vite/commit/c7f37acc6cab3acc8cef50154f840ef71cc42cb4) by @sonofmagic

- 🐛 **对齐 `wevu` 对外 `PropType<T>` 的类型行为到 Vue 官方定义，支持 `type: [String, null]` 等构造器数组写法，并修复该场景下 `InferPropType` 对 `null` 推导退化为 `any` 的问题，保证与 Vue utility types 的使用体验一致。** [`86c7300`](https://github.com/weapp-vite/weapp-vite/commit/86c73009267c18219b2dfbf5772e7f182827cbbd) by @sonofmagic

## 2.0.35

### Patch Changes

- 🐛 **新增原生组件 `properties` 类型推导工具：`InferNativePropType`、`InferNativeProps`、`NativePropType`、`NativeTypeHint`、`NativeTypedProperty`，并在 `wevu-vue-demo` 与文档中补充 `script setup` 直接导入原生组件的推荐写法。现在可基于 `properties` 作为单一数据源生成 props 类型，并通过 `NativePropType<T>`（类似 Vue `PropType<T>`）为联合字面量提供更简洁的类型提示，减少手写接口与重复断言。** [`788a4e0`](https://github.com/weapp-vite/weapp-vite/commit/788a4e080a95524207754bd29316a1504c26b195) by @sonofmagic

- 🐛 **新增 `NativeComponent<Props>` 类型导出，用于简化原生小程序组件在 `script setup` 场景下的类型包装写法；同时补充 `wevu-vue-demo` 原生组件示例（含 `TS + SCSS` 版本）与对应页面引入演示，使原生组件 `props` 在模板中的智能提示与类型约束更稳定、易用。** [`ad8c631`](https://github.com/weapp-vite/weapp-vite/commit/ad8c631f7d1aa19e9f3ac70e5ddc68eb116862ef) by @sonofmagic

## 2.0.34

### Patch Changes

- 🐛 **修复同一节点绑定多个事件时的 inline 事件冲突：编译器为不同事件生成按事件名分片的 dataset 键（如 `data-wv-inline-id-tap`），运行时按 `event.type` 读取对应键并保持兼容回退。补充组件 `emit` 与 `$event` 的单元测试和 e2e 覆盖，并在 `wevu-vue-demo` 的 `vue-compat/template` 页面新增单节点多事件（参数 + `$event`）示例。** [`75121bd`](https://github.com/weapp-vite/weapp-vite/commit/75121bd3642c5b916d7f7e45094f365c7a834509) by @sonofmagic

- 🐛 **导出 `customRef` 及其相关类型声明，完善 `wevu` 对 Vue 3 响应式 API 的可用性。同步扩展 `wevu-vue-demo` 的 `vue-compat` 响应式对照页，新增多源 watch cleanup、watchEffect 句柄控制、effectScope 生命周期、customRef 去抖、shallowReactive/markRaw/toRef 等复杂案例，并补齐能力矩阵与说明文档，确保 typecheck、eslint、stylelint 与 build 全量通过。** [`f881fd9`](https://github.com/weapp-vite/weapp-vite/commit/f881fd90a8a7501550c5a9bf448f810265c205ae) by @sonofmagic

- 🐛 **为 `defineModel` 增加 Vue 3 兼容的 tuple + modifiers 类型与运行时能力：支持 `const [model, modifiers] = defineModel()` 与修饰符泛型推导；同时扩展 `useModel` 的 get/set 选项以适配基于 modifiers 的值转换。补充 `tsd` 类型测试、运行时测试与 `weapp-vite` 的脚本编译测试，并同步更新 `wevu-vue-demo` 的 script-setup 兼容示例与矩阵结论。** [`fd5f8ce`](https://github.com/weapp-vite/weapp-vite/commit/fd5f8ce6bc23d106b43de524ac12d0cc10221c98) by @sonofmagic

- 🐛 **修复组件自定义事件在模板监听中的 `$event` 语义：编译期为组件事件注入 `data-wv-event-detail` 并将简单处理器按 inline 路径编译，运行时据此将 `$event` 解析为 `event.detail`，避免出现 `emit: undefined @ undefined`。同时补充 `wevu-vue-demo` 的 `$event` 上抛示例，并新增编译器、运行时与 e2e 集成测试覆盖。** [`e2aa20e`](https://github.com/weapp-vite/weapp-vite/commit/e2aa20e1cf79b4c5c3c36735b967c6fd5583486f) by @sonofmagic

- 🐛 **对 `wevu` 的 `ref` 类型声明进行兼容增强，新增无参重载以对齐 Vue 3 的使用习惯，并补充对应的类型测试覆盖。同步更新 `wevu-vue-demo` 示例，统一模板为 Vue 语法（`v-for` / `v-if` / `@tap` 等），修复 demo 中现存的 `vue-tsc` 与 eslint 问题，并将 Volar 模板类型库显式切换到 `wevu`，使小程序内置标签类型跳转指向 `wevu` 的 intrinsic elements 声明。** [`31e2db3`](https://github.com/weapp-vite/weapp-vite/commit/31e2db3337842e5fafee21d2d741b8f71643197d) by @sonofmagic

## 2.0.33

### Patch Changes

- 🐛 **修复 `wevu` 运行时的多平台条件裁剪链路：统一通过 `import.meta.env.PLATFORM` 选择小程序全局对象（`tt/my/wx`），并将相关 runtime 入口（组件定义、App 注册、hooks、template refs、页面生命周期）改为走平台适配层，避免非目标平台分支进入最终产物。同时补充 `weapp-vite` npm 构建 define 透传与 e2e 覆盖，分别验证 `wevu` 位于 `devDependencies` 与 `dependencies` 时的构建行为与平台输出。** [`b248a4a`](https://github.com/weapp-vite/weapp-vite/commit/b248a4a6e04dc12dd190fa1b29b615191ed3be87) by @sonofmagic

- 🐛 **修复 `wevu` 运行时在 Node 环境加载时对 `import.meta.env.PLATFORM` 的直接读取问题：当 `import.meta.env` 不存在（如单元测试加载 `vite.config.ts`）时不再抛出异常，改为安全访问并继续走平台兜底逻辑，避免 `Cannot read properties of undefined (reading 'PLATFORM')` 导致构建/测试提前失败。** [`e6c326f`](https://github.com/weapp-vite/weapp-vite/commit/e6c326f64989ae4f0af40553405af19fb1e74f7d) by @sonofmagic

- 🐛 **补齐 `wevu` 在 Vue `<script setup>` 中 `defineProps/defineEmits` 的类型兼容能力：`defineEmits` 现已支持数组、对象、函数重载与命名元组写法，并对齐官方 `EmitFn` 推导行为；同时增强运行时 `ctx.emit`，兼容 `emit(event, ...args)` 多参数形式并按小程序 `triggerEvent` 规范化 `detail/options`。另外新增 `wevu` 与 `weapp-vite` 的类型/编译回归测试，覆盖这些写法的编译与类型校验链路。** [`3a7f4fe`](https://github.com/weapp-vite/weapp-vite/commit/3a7f4fe3e5dbedf6b7c6f09d0cb52e3f4871a792) by @sonofmagic

- 🐛 **修复 `wevu` 组件类型暴露导致的模板补全噪声问题：`defineComponent` 的公开返回类型不再把内部运行时字段作为可补全属性暴露，避免在 Vue SFC 中出现 `:__wevu_options`、`:__wevu_runtime` 及 symbol 序列化键提示。同时同步更新 `lib-mode` 的类型断言用例，确保构建产物导出的组件类型与新的公开契约保持一致。** [`db18a6a`](https://github.com/weapp-vite/weapp-vite/commit/db18a6a9ebd24252128d152190316b525db53380) by @sonofmagic

- 🐛 **修复 `wevu` 在 `createApp().mount()` 返回值上的类型冲突：`RuntimeInstance` 不再在对象字面量直接声明内部字段 `__wevu_touchSetupMethodsVersion`，改为运行时按不可枚举属性注入，消除 TypeScript 报错且不暴露内部实现细节。同步补充并修正 `tsd` 类型测试，覆盖 `RuntimeInstance` 的 `state/computed/methods/proxy/watch/bindModel` 推导行为，以及内部字段不可访问约束，确保类型契约在构建与消费场景下稳定。** [`4f1ebb6`](https://github.com/weapp-vite/weapp-vite/commit/4f1ebb63da9035f5777796ab371fae9db4c7a73f) by @sonofmagic

## 2.0.32

### Patch Changes

- 🐛 **新增 `wevu-retail` 模板选项，并接入 `weapp-vite-wevu-tailwindcss-tdesign-retail-template`。该模板基于零售场景重构为 wevu Vue SFC + weapp-tailwindcss + mokup 风格数据结构，覆盖主包与分包页面骨架，便于快速创建可访问的零售类小程序工程。** [`d504f5a`](https://github.com/weapp-vite/weapp-vite/commit/d504f5aaa192712c5baa181985dc6e0538bdcee9) by @sonofmagic

- 🐛 **修复 `weapp-vite` 在 Vue SFC 模板中引用外部 `wxs` 文件时的产物缺失问题：调整 `wxs` 资源收集与发射时机，补充对 `generateBundle` 阶段 `wxml` 资产的依赖扫描，并兼容 `wxs` / `sjs` / `import-sjs` 标签，确保 `<wxs ... />` 与 `<wxs ...></wxs>` 两种写法均可自动输出到 `dist`。** [`8af1a5d`](https://github.com/weapp-vite/weapp-vite/commit/8af1a5defdb8fe0f662c0d203032867d4500eee0) by @sonofmagic
  - 同时移除 `weapp-vite-wevu-tailwindcss-tdesign-retail-template` 中的 `copy-wxs-sidecar` 构建兜底插件，改为完全依赖 `weapp-vite` 核心链路自动处理 `wxml` 引入的 `wxs` 文件，避免模板侧重复拷贝逻辑。

- 🐛 **修复 `wevu` 模板编译在小程序端对可选链表达式（`?.`）的兼容性问题：在模板编译阶段将 `?.` 安全降级为条件表达式，避免产物 WXML 在微信开发者工具中出现语法报错，并补充对应编译测试与集成测试覆盖。** [`3f1253e`](https://github.com/weapp-vite/weapp-vite/commit/3f1253e5bd1dbb320566e869d172048c63265a56) by @sonofmagic
  - 同时对 `weapp-vite-wevu-tailwindcss-tdesign-retail-template` 进行路由与页面结构对齐：同步主包与分包路由配置至 `tdesign-miniprogram-starter-retail`，补齐自定义 `tabBar` 形态，并将页面壳改为按路由渲染对应版式（如首页、分类、购物车、商品详情、订单列表与表单页等），确保新建项目默认页面可访问且排版语义更接近原零售模板。

## 2.0.31

### Patch Changes

- 🐛 **修复了 dev 模式下新增 SFC 组件可能无法被自动引入及时识别的问题，并补充自动引入与热更新的多平台集成测试覆盖（weapp、alipay、tt），确保页面首次引用新增组件时 `usingComponents` 能稳定更新。与此同时在 CI 中新增对应的平台矩阵任务，持续防止该类回归。** [`69bc2a2`](https://github.com/weapp-vite/weapp-vite/commit/69bc2a20a13a1752e245938d32c8cdd7040e2dbc) by @sonofmagic

- 🐛 **修复分包之间共享 chunk 的跨包引用问题：当分包 `common.js` 被其他分包引用时，构建阶段会在目标分包生成本地副本并重写 `rolldown-runtime.js` 与其他静态依赖路径，避免微信开发者工具运行时报出 `module is not defined`。** [`972cc30`](https://github.com/weapp-vite/weapp-vite/commit/972cc3006f35383d61e0df444c4890495a7fcef8) by @sonofmagic
  - 同时补充 `tdesign-miniprogram-starter-retail` 全页面可访问的 IDE E2E 用例，并增强分类侧栏组件在子组件解绑场景下的方法调用容错，确保默认配置下页面访问更稳定。

- 🐛 **修复分包页面在微信开发者工具中可能出现 `rolldown-runtime.js` 跨包引用失败的问题。构建时会为相关分包生成本地 runtime 并重写引用路径，避免出现“module is not defined”类报错，提升分包项目在真机与开发者工具中的运行稳定性。** [`d945975`](https://github.com/weapp-vite/weapp-vite/commit/d945975553c443054a2e5fae8881d7337705abd8) by @sonofmagic

## 2.0.30

### Patch Changes

- 🐛 **修复 wevu 与 weapp-vite 在 `v-for` 场景下内联事件对象参数的响应式丢失问题：`@tap="updateQuantity(item, -1)"` 传入的 `item` 会恢复为源列表引用，方法内直接修改对象字段可正确触发视图更新。同时补齐 patch 模式下对 ref/reactive 子根变更的调度与回退映射，避免事件逻辑执行但 UI 不刷新的情况。** [`cfcb6b9`](https://github.com/weapp-vite/weapp-vite/commit/cfcb6b9e6a869f038033a2240e2d9a073fc0a903) by @sonofmagic

## 2.0.29

### Patch Changes

- 🐛 **修复 `auto-routes` 生成类型与 `defineAppJson` 的兼容性问题：`AutoRoutesPages`、`AutoRoutesEntries`、`AutoRoutesSubPackages` 改为非 `readonly` tuple，同时保持路由字面量推断精度，确保 `defineAppJson({ pages: routes.pages })` 在 TypeScript 下无需 `as string[]` 即可通过类型检查。** [`093a939`](https://github.com/weapp-vite/weapp-vite/commit/093a93932ff4424e30f4a8c4c100ccafba41aa09) by @sonofmagic
  补充对应回归测试：
  - 新增 `auto-routes` d.ts 生成器单元测试，覆盖 tuple 输出与 `readonly` 回归。
  - 新增 `tsd` 用例，覆盖默认导入与具名导入，并校验非法 `pages` 类型报错。
  - 新增 e2e fixture 与构建/类型检查用例，验证 `weapp-vite build`、`vue-tsc --noEmit` 及产物 `app.json` 路由内容。

- 🐛 **修复 issue #297：模板插值与部分指令中的函数调用表达式不再直接下放到 WXML，而是自动回退为 JS 运行时绑定计算，避免 `{{ sayHello() }}` 在小程序中渲染为空。** [`6f72327`](https://github.com/weapp-vite/weapp-vite/commit/6f72327548f3defdaee6ff6fd395a793ccb16a2d) by @sonofmagic
  - 同时补充单元、集成与 e2e 测试，覆盖插值、`v-text`、`v-bind`、`v-if`、`v-for` 等调用表达式场景，确保回归稳定。

## 2.0.28

### Patch Changes

- 🐛 **fix(wevu)：修复 store `direct` 通知在订阅回调内二次修改状态时可能出现的重入更新风暴问题，避免小程序模拟器长时间无响应；同时补充 `wevu-features` 的 `use-store` 能力展示与对应 e2e 回归覆盖，提升交互稳定性与可验证性。** [`8d2d7f7`](https://github.com/weapp-vite/weapp-vite/commit/8d2d7f7e72d3da5a10fa14e5b66370f739eaf752) by @sonofmagic

- 🐛 **docs(wevu)：补充 wevu 特性展示与 e2e 覆盖，并明确 `useAttrs`、`useSlots`、`defineSlots` 在小程序平台的兼容边界与使用建议。** [`05e5517`](https://github.com/weapp-vite/weapp-vite/commit/05e55174e73c93c69bc28f6d651841161697a425) by @sonofmagic

- 🐛 **fix(wevu)：修复组件 attrs 同步会混入运行时 state 字段的问题，避免 attrs 透传被内部字段污染；同时将 runtime e2e 页面中的 `<text selectable>` 调整为 `user-select` 以消除平台弃用告警。** [`8916fc1`](https://github.com/weapp-vite/weapp-vite/commit/8916fc121800ad0da417cfe1e584b33d20094cc7) by @sonofmagic

- 🐛 **fix(wevu)：修复 runtime watch 停止句柄与注册流程的类型不一致问题，清理小程序全局对象与生命周期补丁的 TS 报错，并补全对外 API 的 tsd 与导出覆盖测试。** [`3af0847`](https://github.com/weapp-vite/weapp-vite/commit/3af0847c326a374cddd1bed283a1f24c4a2358ba) by @sonofmagic

## 2.0.27

### Patch Changes

- 🐛 **修复 issue #294：当页面默认导出为 `Object.assign(...)` 形态时，`onShareAppMessage` / `onShareTimeline` 在编译阶段未正确注入页面 `features` 的问题。** [`d84b693`](https://github.com/weapp-vite/weapp-vite/commit/d84b6937e2fd8189070348733f198bf3cc20017a) by @sonofmagic
  本次修复统一了 Vue 脚本重写与页面特性扫描对 `Object.assign` 选项对象的识别逻辑，确保 share hooks 能稳定注入：
  - `enableOnShareAppMessage`
  - `enableOnShareTimeline`

  同时新增对应单元测试，并在 `e2e-apps/github-issues` 中增加 `issue-294` 页面与 e2e 断言，覆盖真实构建产物验证。

- 🐛 **新增 `vue.template.mustacheInterpolation` 配置项，用于统一控制模板 Mustache 输出风格：** [`12e45d5`](https://github.com/weapp-vite/weapp-vite/commit/12e45d5ed487fce4f28d727ed1618250129de5ab) by @sonofmagic
  - `compact`（默认）：输出 `{{expr}}`
  - `spaced`：输出 `{{ expr }}`

  该选项会作用于 Vue 模板编译与 JSX/TSX 模板编译中的主要 Mustache 产物位置（如插值文本、动态属性、`v-if`/`v-else-if`、`v-for`、slot 相关元属性等）。默认行为保持不变。

  同时保留并兼容 `vue.template.objectLiteralBindMode`：
  - `runtime`（默认）：对象字面量 `v-bind` 走运行时中间变量
  - `inline`：对象字面量直接内联输出

  在 `compact + inline` 下，对象字面量会输出为 `{{ { ... } }}`，用于规避 `{{{` 连续花括号在部分小程序编译链路下的兼容性问题。

- 🐛 **新增 `vue.template.objectLiteralBindMode` 配置项，用于控制对象字面量 `v-bind` 的产物模式：** [`dac5c9f`](https://github.com/weapp-vite/weapp-vite/commit/dac5c9fbd8dbc96e40619aab5f3c38287bf57699) by @sonofmagic
  - `runtime`（默认）：保持现有行为，使用运行时中间变量（如 `__wv_bind_0`）
  - `inline`：直接内联对象字面量，并输出为 `{{ { ... } }}`（插值两侧补空格，避免出现 `{{{`）

  这可以兼容旧项目在小程序端对连续三个花括号的编译限制，同时默认行为保持不变。

## 2.0.26

### Patch Changes

- 🐛 **fix class/style runtime stability for dynamic class expressions and scoped-slot v-for cases** [`2be2749`](https://github.com/weapp-vite/weapp-vite/commit/2be27498a498fb1e85c5533cc521eb42bdad2ba8) by @sonofmagic
  - 为 class/style 的 JS 运行时计算增加表达式异常保护，避免在 `v-if` 守卫与列表项暂不可用时中断渲染
  - 修复 scoped slot 虚拟模块在 class 计算代码中缺失 `unref` 导入的问题
  - 补充相关单元测试与 e2e 回归用例，覆盖 `v-for` 动态 class 与 `root.a` 这类场景

## 2.0.25

### Patch Changes

- 🐛 **将 Vue 模板 `:class` / `:style` 的默认运行时从 `auto` 调整为 `js`，减少“WXS 模式下表达式级回退到 JS”带来的行为分岔，提升不同表达式形态下的一致性与可预期性。** [`65f9f13`](https://github.com/weapp-vite/weapp-vite/commit/65f9f131549181dcb23ac3f2767970663bd6c3c7) by @sonofmagic
  同时保留 `auto` / `wxs` 可选策略：
  - `auto` 仍会在平台支持 WXS 时优先使用 WXS，否则回退 JS。
  - `wxs` 在平台不支持时仍会回退 JS 并输出告警。

  更新了对应的配置类型注释与文档示例，明确默认值为 `js`。

## 2.0.24

### Patch Changes

- 🐛 **fix: weapp-vite open 场景在微信登录失效时增加友好提示与按键重试。** [`0e27865`](https://github.com/weapp-vite/weapp-vite/commit/0e2786529c0b3280d1682a0707d131c2ec65fb23) by @sonofmagic
  - `weapp-vite dev -o` / `weapp-vite open` 调用 IDE 时，命中 `code: 10` 或 `需要重新登录` 会给出明确提示。
  - 支持按 `r` 重试，按 `q`、`Esc` 或 `Ctrl+C` 取消。
  - 补充 `openIde` 与重试辅助函数单元测试，覆盖重试成功、取消和非登录错误分支。

- 🐛 **refactor: 提炼微信 IDE 登录失效重试逻辑，减少跨包重复实现。** [`ff78c39`](https://github.com/weapp-vite/weapp-vite/commit/ff78c394a29766497a7da57f46a2b394fbfc82d6) by @sonofmagic
  - `weapp-ide-cli` 对外导出登录失效识别与按键重试 helper。
  - `weapp-vite` 的 `open/dev -o` 逻辑改为复用 `weapp-ide-cli` helper，不再维护重复副本。
  - 清理 `weapp-vite` 本地重复重试模块，并更新单测 mock 到统一导出入口。

- 🐛 **feat: 统一 CLI 终端染色入口到 logger colors。** [`f7f936f`](https://github.com/weapp-vite/weapp-vite/commit/f7f936f1884cf0e588764132bf7f280d5d22bf41) by @sonofmagic
  - `@weapp-core/logger` 新增 `colors` 导出（基于 `picocolors`），作为统一终端染色能力。
  - 对齐 `packages/*/src/logger.ts` 适配层，统一通过本地 `logger` 入口透传 `colors`。
  - 后续 CLI 代码可统一使用 `from '../logger'`（或 `@weapp-core/logger`）进行染色，避免分散依赖与手写 ANSI。
  - 本次发布包含 `weapp-vite`，同步 bump `create-weapp-vite` 以保持脚手架依赖一致性。

- 🐛 **fix: 支持小程序事件修饰符 `.stop` 并完善修饰符校验与测试矩阵。** [`eef1eec`](https://github.com/weapp-vite/weapp-vite/commit/eef1eec1a5d73feaa8e82a74ebf4b5d7270159aa) by @sonofmagic
  - 模板编译器将 `@tap.stop` 视为阻止冒泡语义，输出 `catchtap`（含捕获组合输出 `capture-catch:tap`）。
  - WXML 扫描链路同步支持 `.stop`，与 `.catch/.capture/.mut` 前缀决策保持一致。
  - ESLint `vue/valid-v-on` 放行 weapp 场景常用修饰符，避免 `@tap.catch/@tap.mut/@tap.capture` 误报。
  - 补充编译与扫描单元测试矩阵，覆盖 `stop/catch/capture/mut` 及与 Vue 常见修饰符组合场景。

- 🐛 **fix: 修复 WeappIntrinsicElements 属性合并导致 `id` 推断为 `undefined` 的问题。** [`24f4d06`](https://github.com/weapp-vite/weapp-vite/commit/24f4d06d09986d48a56660d04481e44bb68afe5a) by @sonofmagic
  - 生成器跳过与基础属性（`id/class/style/hidden`）同名的组件属性，避免交叉类型冲突。
  - 基础属性 `id` 调整为 `string | number`，使 `map` 等场景可同时接收字符串与数字。
  - 补充 `tsd` 回归测试，验证 `WeappIntrinsicElements['map']['id']` 为 `string | number | undefined`。

- 🐛 **chore: 统一 CLI 中优先级输出风格与终端染色。** [`51735d0`](https://github.com/weapp-vite/weapp-vite/commit/51735d05925951eb9dc99a5f88a555178f845021) by @sonofmagic
  - `weapp-ide-cli`：补齐 `colors` 相关测试 mock，确保配置解析与 `minidev` 安装提示在新增染色后行为稳定。
  - `weapp-vite`：对齐 `openIde` 重试提示日志级别（`error/warn/info`），并统一通过 `logger.colors` 做重点信息高亮。
  - `weapp-vite`：优化运行目标、构建完成、分析结果写入等高频输出，统一命令/路径/URL 的染色展示。
  - 包含 `weapp-vite` 变更，按仓库约定同步 bump `create-weapp-vite`。

- 🐛 **fix: 优化 CLI 高优先级输出一致性与机器可读性。** [`5bc7afb`](https://github.com/weapp-vite/weapp-vite/commit/5bc7afb8ad3a425334f3d348bd86162184bbdfcf) by @sonofmagic
  - `weapp-vite analyze --json` 在 JSON 输出模式下默认静默平台提示，避免污染标准输出。
  - `weapp-vite open` 登录失效重试提示改为复用 `weapp-ide-cli` 的统一格式化 helper。
  - `create-weapp-vite` CLI 错误输出改为统一 logger，并区分“取消创建”和“创建失败”。
- 📦 **Dependencies** [`f7f936f`](https://github.com/weapp-vite/weapp-vite/commit/f7f936f1884cf0e588764132bf7f280d5d22bf41)
  → `@weapp-core/logger@3.1.0`

## 2.0.23

### Patch Changes

- 🐛 **fix(alipay): 兼容 antd-mini 文档的 `antd-mini/es/*` 组件路径。** [`fcb33fb`](https://github.com/weapp-vite/weapp-vite/commit/fcb33fbfaea80fb590427a56e5111b3e67fe7112) by @sonofmagic
  - 支付宝 `node_modules` npm 模式下，miniprogram 包构建时会同步复制包内 `es/` 目录到产物，避免 `usingComponents` 指向 `antd-mini/es/*` 时找不到组件文件。
  - 修复支付宝 npm 缓存命中时的重建判定：当源包存在 `es/` 但缓存产物缺失时，会自动触发重建，避免继续复用旧产物。
  - `alipay-antd-mini-demo` 示例切换为 antd-mini 文档一致写法：`usingComponents` 使用 `antd-mini/es/Button/index`。

- 🐛 **fix: 修复多平台（尤其支付宝）编译兼容与 `wpi` 注入问题。** [`89acadd`](https://github.com/weapp-vite/weapp-vite/commit/89acadd1016f14b1df249a13989ae2791fa4e43e) by @sonofmagic
  - 模板转换增强：支付宝产物支持 `wx:* -> a:*`、`bind/catch` 事件映射到 `on*/catch*`，并将 PascalCase 组件标签与 `usingComponents` key 归一化为 kebab-case。
  - JS 目标兼容增强：支付宝在未显式配置 `build.target` 时默认降级到 `es2015`，避免可选链等语法在开发者工具中报错。
  - `injectWeapi` 注入增强：在显式开启 `replaceWx: true` 时，编译阶段自动把 `wx/my` API 调用重写为统一 `wpi` 访问，且运行时不再依赖 `globalThis`，兼容支付宝环境。
  - 默认行为保持不变：`injectWeapi.replaceWx` 仍默认关闭，需要在项目中显式开启。

- 🐛 **fix: 修复 class/style helper 在微信与支付宝脚本模块语法差异下的兼容回归。** [`6e7c559`](https://github.com/weapp-vite/weapp-vite/commit/6e7c55998303f0c50857f439becae8e30e3615d6) by @sonofmagic
  - `@wevu/compiler` 的 class/style helper 改为按脚本扩展名分支生成：
    - `.wxs` 保持 `module.exports`、`Array.isArray` 与 `String.fromCharCode` 路径，恢复微信端行为。
    - `.sjs` 继续使用 `export default`，并避免 `Array` / `String.fromCharCode` 等在支付宝 SJS 下受限的标识符。
  - `weapp-vite` 补充对应单测断言，分别覆盖 `wxs` 与 `sjs` helper 输出约束。
  - 在 `e2e-apps/wevu-runtime-e2e` 新增 `pages/class-style/index.vue`，补充 class/style 多形态绑定示例，并同步 `weapp/alipay/tt` e2e 快照，防止后续回归。

- 🐛 **fix: `injectWeapi` 不再生成 `weapp-vite.weapi.d.ts`，并将 `wpi` 全局类型并入 `weapp-vite/client`，避免用户手动修改 `tsconfig` include。** [`685cd70`](https://github.com/weapp-vite/weapp-vite/commit/685cd70a59c05f6054ee61d81b814b7cdc57c48a) by @sonofmagic

- 🐛 **fix: 修复支付宝平台 npm 构建与 scoped slot 兼容问题。** [`2cf1f5c`](https://github.com/weapp-vite/weapp-vite/commit/2cf1f5c73a80c5d2f9c1c22aa396a1c47f599e02) by @sonofmagic
  - 支付宝平台下对小程序 npm 包增加稳定转换：模板后缀/语法映射、ESM 到 CJS 转换、嵌套依赖提升与缓存自修复，避免 `cannot resolve module`、`unknown is outside of the project` 等报错。
  - 支付宝平台下为 `componentGenerics` 自动补齐默认占位组件，并在构建产物中自动发出占位组件文件，修复 `componentGenerics ... 必须配置默认自定义组件`。
  - 优化 scoped slot 子组件 `usingComponents` 收敛逻辑，仅保留模板实际依赖，减少无效引用与平台差异问题。

- 🐛 **feat: 支持支付宝平台 npm 目录策略切换，并默认使用 `node_modules`。** [`28123ac`](https://github.com/weapp-vite/weapp-vite/commit/28123acad176ced6ea6ace113ac0161a2bf49115) by @sonofmagic
  - 新增 `weapp.npm.alipayNpmMode` 配置，支持 `node_modules` 与 `miniprogram_npm` 两种模式。
  - 默认策略切换为 `node_modules`，更贴近支付宝小程序 npm 管理语义。
  - 统一支付宝平台 `usingComponents` 与 JS `require` 的 npm 引用改写逻辑，确保与目录策略一致。
  - npm 构建与输出清理流程按策略保留对应目录，避免缓存与产物目录错配。

- 🐛 **fix(alipay): 避免运行时直接访问 `globalThis` 导致支付宝端报错。** [`aabec69`](https://github.com/weapp-vite/weapp-vite/commit/aabec69b7e543d092113b377af1a552d623553e5) by @sonofmagic
  - wevu 运行时在自动注册 App、页面生命周期补丁与 scoped-slot 全局注入场景，改为优先使用小程序全局对象（`wx`/`my`），避免在关键路径直接访问 `globalThis`。
  - 修复支付宝模拟器中 `ReferenceError: globalThis is not defined`，兼容不提供 `globalThis` 的运行环境。

- 🐛 **feat: 支持支付宝平台一键打开 IDE，并优化 lib-mode 测试产物稳定性。** [`f46e69c`](https://github.com/weapp-vite/weapp-vite/commit/f46e69cbb7c6aef720d1ace6aa58916e0d28dc1a) by @sonofmagic
  - `weapp-ide-cli` 新增 `open --platform alipay` 分流能力，自动转发到 `minidev ide`。
  - `weapp-vite` 新增 `open --platform <platform>`，且在 `dev/build --open -p alipay` 场景自动走支付宝 IDE 打开链路。
  - `weapp-vite` 的 `injectWeapi` 在 app 注入阶段新增原生平台 API 兜底探测，避免支付宝环境下 `wpi` 未绑定原生 `my` 导致 `setClipboardData:fail method not supported`。
  - `weapp-vite` 在多平台模式下针对支付宝平台优化 npm 输出目录推导：若未手动配置 `packNpmRelationList`，会基于 `mini.project.json` 的 `miniprogramRoot` 计算 npm 输出目录，避免 npm 产物错误写入项目根目录。
  - `weapp-vite` 的 `lib-mode` 测试改为写入临时输出目录，避免每次单测改写 fixture 内的 `.d.ts` 文件。

- 🐛 **feat: 完善支付宝示例与模板脚本模块兼容。** [`b474b9a`](https://github.com/weapp-vite/weapp-vite/commit/b474b9ade95d3430c11256f41d665bc14e268875) by @sonofmagic
  - 在 `apps/alipay-antd-mini-demo` 新增 wevu SFC 页面示例，并补充首页跳转入口。
  - 修复支付宝模板脚本模块标签转换，统一输出 `import-sjs` 并映射 `from/name` 属性，避免开发者工具报 `<sjs>` 不存在。
  - 同步完善 wxml/nmp builder 相关测试，覆盖支付宝脚本模块转换链路。

## 2.0.22

### Patch Changes

- 🐛 **支持在 App 入口可选注入 @wevu/api 的 wpi，且仅在启用时生成全局类型提示与可选 wx 替换配置（默认关闭，需显式开启）。** [`21e2d6f`](https://github.com/weapp-vite/weapp-vite/commit/21e2d6f2eec95502a0eb6e4f0d911a327e180478) by @sonofmagic

- 🐛 **lib 模式默认生成 dts，支持 .vue/wevu SFC，并修复 rolldown dts 输出命名冲突；新增 internal 模式生成 Vue SFC dts（vue-tsc 作为可选后备），同时导出 WevuComponentConstructor 以保障声明生成。** [`7ac4a68`](https://github.com/weapp-vite/weapp-vite/commit/7ac4a688e88e21192cf0806ca041db0773ac3506) by @sonofmagic

## 2.0.21

### Patch Changes

- 🐛 **调整 lib 模板的 dev/dev:open 脚本与默认 AppID 配置。** [`22590cf`](https://github.com/weapp-vite/weapp-vite/commit/22590cf1bcfd4fb0db3c5d17de869528c634383e) by @sonofmagic

## 2.0.20

### Patch Changes

- 🐛 **完善中文 JSDoc 与类型提示，提升 dts 智能提示体验。** [`f2d613f`](https://github.com/weapp-vite/weapp-vite/commit/f2d613fcdafd5de6bd145619f03d12b0b465688f) by @sonofmagic
- 📦 **Dependencies** [`f2d613f`](https://github.com/weapp-vite/weapp-vite/commit/f2d613fcdafd5de6bd145619f03d12b0b465688f)
  → `@weapp-core/logger@3.0.3`

## 2.0.19

### Patch Changes

- 🐛 **新增 weapp-vite-lib-template 组件库模板。** [`d804756`](https://github.com/weapp-vite/weapp-vite/commit/d80475675ffad8fff1c363858d1eed4238b3440b) by @sonofmagic

- 🐛 **升级多处依赖版本（Babel 7.29、oxc-parser 0.112、@vitejs/plugin-vue 6.0.4 等）。** [`8143b97`](https://github.com/weapp-vite/weapp-vite/commit/8143b978cc1bbc41457411ffab007ef20a01f628) by @sonofmagic
  - 同步模板与示例的 tdesign-miniprogram、weapp-tailwindcss、autoprefixer 等版本，确保脚手架默认依赖一致。

- 🐛 **Miscellaneous improvements** [`c4d3abb`](https://github.com/weapp-vite/weapp-vite/commit/c4d3abb8e4642dc38fa9a47efc7ac26b41703db1) by @sonofmagic
  - 新增共享 chunk 的配置能力，并在构建阶段仅使用 rolldown（忽略 rollupOptions）。
  - web 插件在未扫描模板列表时也可直接转换 wxml。

- 🐛 **Miscellaneous improvements** [`737cc22`](https://github.com/weapp-vite/weapp-vite/commit/737cc220cd44cd0cf1ec6597fc80d1efbf47b9a1) by @sonofmagic
  - 新增 weapp.lib 库模式，用于按入口打包组件/模块，并支持自动生成组件 JSON。

## 2.0.18

### Patch Changes

- 🐛 **修复 Vue SFC `<style>` 中 `@import` 相对路径解析基准错误，确保按当前 SFC 目录解析。** [`2e218e6`](https://github.com/weapp-vite/weapp-vite/commit/2e218e69812a5795231b6e718daed585cd37f29f) by @sonofmagic

## 2.0.17

### Patch Changes

- 🐛 **修复 Windows 下 Vue `<style>` 请求带 `?query` 导致的路径读取错误，改用虚拟 ID 并在解析时还原真实路径。** [`eed307c`](https://github.com/weapp-vite/weapp-vite/commit/eed307c73c431809284a6515f1ee4fe977af2863) by @sonofmagic

## 2.0.16

### Patch Changes

- 🐛 **修复 Windows 下 .vue 样式虚拟请求解析导致的构建报错，并改进 /@fs 与路径分隔符处理（含 WXS/WXML 与缓存 key）以提升跨平台兼容性。** [`0d7f854`](https://github.com/weapp-vite/weapp-vite/commit/0d7f854d4bbcb544ada423137747a0a898e21308) by @sonofmagic

## 2.0.15

### Patch Changes

- 🐛 **升级依赖版本：rolldown 至 1.0.0-rc.2、vite 至 8.0.0-beta.10。** [`aca8b62`](https://github.com/weapp-vite/weapp-vite/commit/aca8b62241f1e735bb159c13c26d925718e81a3f) by @sonofmagic

- 🐛 **将 Vue SFC 与 wevu 编译逻辑迁移到 `@wevu/compiler`，由 `wevu/compiler` 统一导出，`weapp-vite` 改为使用新编译器入口并清理重复实现。** [`5b1b6c3`](https://github.com/weapp-vite/weapp-vite/commit/5b1b6c33746417911cc4490ce47967fb510171ce) by @sonofmagic

- 🐛 **为 wevu 的 watch/watchEffect 增加 pause 与 resume 能力，同时保持 stop 旧用法兼容。** [`d54d430`](https://github.com/weapp-vite/weapp-vite/commit/d54d430a93b8045f91ab1a16b2501dceda10a824) by @sonofmagic

- 🐛 **修复 watch/watchEffect 在同一微任务内重复触发的问题，确保调度去重生效。** [`7fc02cd`](https://github.com/weapp-vite/weapp-vite/commit/7fc02cd1fb7858358445b07bfd24f443b1a99ad3) by @sonofmagic

## 2.0.14

### Patch Changes

- 🐛 **支持内联事件参数使用动态表达式，并兼容小程序侧数组参数传递。** [`8940c7f`](https://github.com/weapp-vite/weapp-vite/commit/8940c7fd87b6153137ca9b33b8d0925a4b592c4e) by @sonofmagic

- 🐛 **支持内联事件表达式在编译期生成执行器，保证复杂参数调用在小程序运行时可用。** [`9c90f7b`](https://github.com/weapp-vite/weapp-vite/commit/9c90f7b6777374aaf54ee4b5955a4b01209acc0f) by @sonofmagic

- 🐛 **修复作用域插槽生成规则与样式隔离默认值，更新 e2e 运行与展示配置并补齐小程序类型定义。** [`53c2b8a`](https://github.com/weapp-vite/weapp-vite/commit/53c2b8a5f25e59d621d6dac5018b56352aaa785f) by @sonofmagic

- 🐛 **修复内联事件表达式执行器在运行时读取不到 inline map 的问题，确保模板事件可正常触发。** [`fc5657e`](https://github.com/weapp-vite/weapp-vite/commit/fc5657e7c66c4150aba47829b48f5d38f797d797) by @sonofmagic

- 🐛 **修复组件化页面生命周期补触发逻辑，补齐下拉刷新/滚动事件，并避免生命周期日志丢失。** [`26bc05b`](https://github.com/weapp-vite/weapp-vite/commit/26bc05b47852aaf07c45e7528c60269dc36d1d9b) by @sonofmagic

## 2.0.13

### Patch Changes

- 🐛 **仅在 v-slot 传递作用域参数时生成 scoped slot 组件，普通具名插槽回退为原生 slot；新增 weapp.vue.template.scopedSlotsRequireProps 配置以切换旧行为。** [`a97099c`](https://github.com/weapp-vite/weapp-vite/commit/a97099cdfa28362b13481758405cda8961858b39) by @sonofmagic

- 🐛 **新增组件选项 `setupLifecycle`（`created` / `attached`），并将默认执行时机改为 `attached`，以便 setup 拿到外部传入的 props；同时 weapp-vite 类型对齐该配置。** [`5c42bd3`](https://github.com/weapp-vite/weapp-vite/commit/5c42bd34cac020dc6d6bd094b6b45e78cdb6a53c) by @sonofmagic

## 2.0.12

### Patch Changes

- 🐛 **补全 button 的 open-type 枚举与事件类型，并补充单元测试和 tsd 覆盖。** [`a6e3ba8`](https://github.com/weapp-vite/weapp-vite/commit/a6e3ba8be6c22dcfbf2edbfa9c977f8a39aef119) by @sonofmagic

- 🐛 **按组件拆分 weappIntrinsicElements 输出文件，并为每个组件文件补充文档链接注释。** [`d160032`](https://github.com/weapp-vite/weapp-vite/commit/d16003262a212070f1547db80ab2b7f7aecb8a83) by @sonofmagic

- 🐛 **稳定模板 watch rebuild 测试，避免复制 node_modules 触发随机失败，并补齐测试类型定义。** [`556d45d`](https://github.com/weapp-vite/weapp-vite/commit/556d45dc74a646da65046ad8dae4043ff53a6f26) by @sonofmagic

- 🐛 **修复 Windows 下脚本改动不触发热更新的问题，并补充模板 watch rebuild 测试。** [`50cae1b`](https://github.com/weapp-vite/weapp-vite/commit/50cae1b62e63d24cf7cdb2babf185a283af81b29) by @sonofmagic

## 2.0.11

### Patch Changes

- 🐛 **multiPlatform 改为使用 `config/<platform>/project.config.json` 目录约定，禁用 `--project-config` 覆盖，并在构建时同步复制平台配置目录到产物根目录。** [`3c9113d`](https://github.com/weapp-vite/weapp-vite/commit/3c9113d2945c1ebbece9f85b5b914ca975d2e837) by @sonofmagic

- 🐛 **新增 multiPlatform 多平台配置支持，允许按平台加载 `project.config` 并支持 `--project-config` 覆盖路径。** [`763e936`](https://github.com/weapp-vite/weapp-vite/commit/763e9366831f17042592230d7f0d09af9df53373) by @sonofmagic
  - 补充 `LoggerConfig`/`WeappWebConfig` 的 JSDoc 示例，提升 IDE 提示体验。 避免 rolldown-require 在配置 `codeSplitting` 时触发 `inlineDynamicImports` 的警告。

- 🐛 **支持按平台读取对应的项目配置文件名（如 `mini.project.json`、`project.swan.json`），并同步多平台示例配置目录结构。** [`e56da93`](https://github.com/weapp-vite/weapp-vite/commit/e56da9360230735055c513f1e6b5a8bd99ad892e) by @sonofmagic

- 🐛 **对齐 `watch`/`watchEffect` 的 `flush`/`scheduler`/`once`/`deep:number` 行为与类型，并补充 `traverse` 分支覆盖；修复 rolldown-require 的类型构建错误。** [`28ea55d`](https://github.com/weapp-vite/weapp-vite/commit/28ea55d72429fd416502d80fa9819c099fe16dd3) by @sonofmagic

- 🐛 **修复多平台构建时 `dist` 输出与 `project.config` 同步路径不一致的问题，统一将 `miniprogramRoot=dist` 映射为 `dist/<platform>/dist` 并自动复制平台 `project.config`。** [`9a99f4c`](https://github.com/weapp-vite/weapp-vite/commit/9a99f4c4b249c97bf76733027307028f9c5c5d68) by @sonofmagic
  - 显式禁用 `inlineDynamicImports` 以避免 `codeSplitting` 下的警告。

- 🐛 **开发态构建结束后可自动 touch `app.wxss` 以触发微信开发者工具热重载（检测 weapp-tailwindcss）。** [`f428178`](https://github.com/weapp-vite/weapp-vite/commit/f428178aa44a07e48f33f5aaa9f5e875440bd6db) by @sonofmagic

- 🐛 **调整 Web 默认输出目录为 `dist/web`，并确保 Web 构建 `outDir` 不被小程序构建配置覆盖。** [`742eb8f`](https://github.com/weapp-vite/weapp-vite/commit/742eb8f321aa02cadac4ec3b91753d7cf8d653ce) by @sonofmagic
- 📦 **Dependencies** [`763e936`](https://github.com/weapp-vite/weapp-vite/commit/763e9366831f17042592230d7f0d09af9df53373)
  → `@weapp-core/logger@3.0.2`

## 2.0.10

### Patch Changes

- 🐛 **完善多平台模板与脚本模块的输出后缀适配，并同步 JSON 产物扩展名处理。** [`31e4d25`](https://github.com/weapp-vite/weapp-vite/commit/31e4d2520f89e57bc1e06561c57351aa18f635bb) by @sonofmagic

## 2.0.9

### Patch Changes

- 🐛 **破坏性变更：`setup` 与 Vue 3 对齐，仅支持 `setup(props, ctx)`。请将 `setup(ctx)` 改为 `setup(_, ctx)`。** [`158306b`](https://github.com/weapp-vite/weapp-vite/commit/158306b75191040ecbdef846e66e9f6e49036d19) by @sonofmagic

## 2.0.8

### Patch Changes

- 🐛 **补充发布规则校验，确保依赖与模板更新时同步触发 create-weapp-vite 发布。** [`1c2fe4f`](https://github.com/weapp-vite/weapp-vite/commit/1c2fe4fbf65464515923ae9553fcf42941b81ddd) by @sonofmagic

## 2.0.7

### Patch Changes

- 🐛 **补充 wevu@1.2.0 的 Volar 类型依赖说明，避免脚手架用户对 `vue` 依赖产生误解。** [`2c407ba`](https://github.com/weapp-vite/weapp-vite/commit/2c407baf41954ccececeb4e04095f21aeb08b91d) by @sonofmagic

## 2.0.6

### Patch Changes

- 🐛 **同步模板配置，支持 `weapp.logger` 日志过滤能力。** [`8b094d0`](https://github.com/weapp-vite/weapp-vite/commit/8b094d0981c1e8122c1c6b5fba569479a5be59d4) by @sonofmagic
- 📦 **Dependencies** [`13703f5`](https://github.com/weapp-vite/weapp-vite/commit/13703f5ca6010df78f5d08a2a9d4dbed4c5ccea4)
  → `@weapp-core/logger@3.0.1`

## 2.0.5

### Patch Changes

- 🐛 **优化 wevu + tailwindcss + TDesign 模板：提炼通用 hooks/utils 与类型复用。** [`b17a4ce`](https://github.com/weapp-vite/weapp-vite/commit/b17a4cec352430638a67691ab28920ad735316b4) by @sonofmagic

## 2.0.4

### Patch Changes

- 🐛 **更新模板组件的 props 定义，统一使用 `defineProps<T>() + withDefaults` 写法。** [`db07d38`](https://github.com/weapp-vite/weapp-vite/commit/db07d3836a2e842ac387c6f11f0225e92f31a300) by @sonofmagic

## 2.0.3

### Patch Changes

- 🐛 **更新 wevu 模板的 typecheck 脚本，统一使用 `tsconfig.app.json` 并补充 `vue-tsc` 依赖。** [`571a28d`](https://github.com/weapp-vite/weapp-vite/commit/571a28decda0ed67738bb33b87c6a56bf6dade97) by @sonofmagic

## 2.0.2

### Patch Changes

- 🐛 **chore: 同步模板** [`d613292`](https://github.com/weapp-vite/weapp-vite/commit/d61329235b999ccd207816886bb4cdbf5d32d826) by @sonofmagic

## 2.0.1

### Patch Changes

- 🐛 **修复：创建项目时将模板中的 workspace 依赖改为 ^ 版本范围（weapp-vite/wevu）。** [`86e5882`](https://github.com/weapp-vite/weapp-vite/commit/86e58822f4d82e82f840179b9cc8826fd3e81dd3) by @sonofmagic

## 2.0.0

### Major Changes

- 🚀 **改为纯 ESM 产物，移除 CJS 导出，并将 Node 引擎版本提升至 ^20.19.0 || >=22.12.0。** [`eeca173`](https://github.com/weapp-vite/weapp-vite/commit/eeca1733e3074d878560abdb5b3378021dc02eda) by @sonofmagic
  - `vite.config.ts` 等配置请统一使用 ESM 写法，避免 `__dirname`/`require` 这类 CJS 语法。
  - `loadConfigFromFile` 在遇到 CJS 写法导致加载失败时，应提示：`XXX` 为 CJS 格式，需要改为 ESM 写法（可参考 `import.meta.dirname` 等用法）。

### Patch Changes

- 📦 **Dependencies** [`eeca173`](https://github.com/weapp-vite/weapp-vite/commit/eeca1733e3074d878560abdb5b3378021dc02eda)
  → `@weapp-core/logger@3.0.0`

## 1.3.7

### Patch Changes

- 🐛 **chore: update template** [`3e10fc7`](https://github.com/weapp-vite/weapp-vite/commit/3e10fc76b34e5f40b411365bce784bde6cebadff) by @sonofmagic

## 1.3.6

### Patch Changes

- 🐛 **fix: weapp-vite 和 weapp-tailwindcss 依赖了不同版本的 Vite 类导致类型不匹配 ts 类型报错** [`66247be`](https://github.com/weapp-vite/weapp-vite/commit/66247be326609433a10468da04310f0b318add61) by @sonofmagic

## 1.3.5

### Patch Changes

- 🐛 **chore: 更新模板** [`fcbbf78`](https://github.com/weapp-vite/weapp-vite/commit/fcbbf7893f701538b3bd2a3975aa903fbea653b0) by @sonofmagic

## 1.3.4

### Patch Changes

- 🐛 **chore(deps): upgrade** [`b6d5f0e`](https://github.com/weapp-vite/weapp-vite/commit/b6d5f0e6e26c76b78462d0a335d4da7341b8d969) by @sonofmagic

## 1.3.3

### Patch Changes

- 🐛 **chore: 更新初始模板** [`b4b0371`](https://github.com/weapp-vite/weapp-vite/commit/b4b03718bee9f1864c0606ca29e0a34210f14dc2) by @sonofmagic

## 1.3.2

### Patch Changes

- 🐛 **chore(deps): upgrade** [`9260af8`](https://github.com/weapp-vite/weapp-vite/commit/9260af8561ad47b55f2b6084be7f2b039c5d523c) by @sonofmagic

## 1.3.1

### Patch Changes

- 🐛 **chore(deps): upgrade** [`b78c8d2`](https://github.com/weapp-vite/weapp-vite/commit/b78c8d2cc151fd7862cf485ebcae976023b785ad) by @sonofmagic

## 1.3.0

### Minor Changes

- ✨ **## 变更说明** [`efa28eb`](https://github.com/weapp-vite/weapp-vite/commit/efa28ebddba79c054f98f594181b5844a0042eaa) by @sonofmagic
  - `weapp-vite` CLI 移除 `create` 命令；新项目创建请使用 `create-weapp-vite`（例如 `pnpm create weapp-vite`）。
  - `@weapp-core/init` 仅保留“初始化配置文件”相关能力（如 `initConfig`），不再包含模板项目创建能力。
  - 模板同步与模板创建逻辑迁移到 `create-weapp-vite`，并对外导出 `createProject` / `TemplateName`。

## 1.2.1

### Patch Changes

- 📦 **Dependencies** [`c02b412`](https://github.com/weapp-vite/weapp-vite/commit/c02b41283cb4862891e85750b72c9937a339f4fe)
  → `@weapp-core/init@4.1.1`

## 1.2.0

### Minor Changes

- ✨ **新增 `wevu-tdesign` 模板可选项（对应 `templates/weapp-vite-wevu-tailwindcss-tdesign-template`），可通过 `@weapp-core/init` 与 `create-weapp-vite` 选择创建。** [`802a189`](https://github.com/weapp-vite/weapp-vite/commit/802a1891a555b95d0efc4f0e6393758d536aad76) by @sonofmagic

### Patch Changes

- 📦 **Dependencies** [`802a189`](https://github.com/weapp-vite/weapp-vite/commit/802a1891a555b95d0efc4f0e6393758d536aad76)
  → `@weapp-core/init@4.1.0`

## 1.1.5

### Patch Changes

- 📦 **Dependencies** [`78e8ab8`](https://github.com/weapp-vite/weapp-vite/commit/78e8ab8c4f923a138c4216933186853fd8b81f63)
  → `@weapp-core/init@4.0.1`

## 1.1.4

### Patch Changes

- 🐛 **修复 `create-weapp-vite` 交互式模板列表未展示 `wevu` 模板的问题，并在发布前自动构建 `dist`，避免新模板选项遗漏。** [`16eb095`](https://github.com/weapp-vite/weapp-vite/commit/16eb095702a9ee60bc326268ae736cfc82e2775e) by @sonofmagic

## 1.1.3

### Patch Changes

- 📦 **Dependencies** [`488f8c4`](https://github.com/weapp-vite/weapp-vite/commit/488f8c4e62dcbd58a5b6823d97992680d077e4f7)
  → `@weapp-core/init@4.0.0`

## 1.1.3-alpha.1

### Patch Changes

- 📦 **Dependencies** [`b34b972`](https://github.com/weapp-vite/weapp-vite/commit/b34b972610bbceb7ed1ad1e9dddb689b0909390e)
  → `@weapp-core/init@3.0.8-alpha.1`

## 1.1.3-alpha.0

### Patch Changes

- Updated dependencies [[`9d4a8bd`](https://github.com/weapp-vite/weapp-vite/commit/9d4a8bd8b9d29274f9d3a75eaa20bfec27593e59)]:
  - @weapp-core/init@3.0.8-alpha.0

## 1.1.2

### Patch Changes

- [`a876ddb`](https://github.com/weapp-vite/weapp-vite/commit/a876ddb9f35757093f2d349c2a9c70648c278c44) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`a876ddb`](https://github.com/weapp-vite/weapp-vite/commit/a876ddb9f35757093f2d349c2a9c70648c278c44)]:
  - @weapp-core/init@3.0.7

## 1.1.1

### Patch Changes

- [`6e4dd84`](https://github.com/weapp-vite/weapp-vite/commit/6e4dd8483e6ec7b42cbcd9c8ea067fbc07969506) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`fe93e13`](https://github.com/weapp-vite/weapp-vite/commit/fe93e13467c8a0db1fc7a24f438bcf7777862c82)]:
  - @weapp-core/init@3.0.6

## 1.1.0

### Minor Changes

- [`835d07a`](https://github.com/weapp-vite/weapp-vite/commit/835d07a2a0bbd26a968ef11658977cbfed576354) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

### Patch Changes

- Updated dependencies [[`ec736cd`](https://github.com/weapp-vite/weapp-vite/commit/ec736cd433fa344c7d10a96efe8af4ee899ba36b)]:
  - @weapp-core/init@3.0.5

## 1.0.24

### Patch Changes

- Updated dependencies [[`965f0c8`](https://github.com/weapp-vite/weapp-vite/commit/965f0c899e42af7fab45a6f5e3a6a64c946d72ec)]:
  - @weapp-core/init@3.0.4

## 1.0.23

### Patch Changes

- [`0259a17`](https://github.com/weapp-vite/weapp-vite/commit/0259a17018527d52df727c098045e208c048f476) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade tsdown

- Updated dependencies [[`8bdcc85`](https://github.com/weapp-vite/weapp-vite/commit/8bdcc858b2f967c4b96ec997536c0ad5c8157aa7)]:
  - @weapp-core/init@3.0.3

## 1.0.22

### Patch Changes

- Updated dependencies [[`38b486d`](https://github.com/weapp-vite/weapp-vite/commit/38b486d05d81fc5635a449f611fa2e6131af7823)]:
  - @weapp-core/init@3.0.2

## 1.0.21

### Patch Changes

- [`84fc3cc`](https://github.com/weapp-vite/weapp-vite/commit/84fc3cc1e04169e49878f85825a3c02c057337fb) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 rolldown-vite 版本

## 1.0.20

### Patch Changes

- Updated dependencies [[`2d86964`](https://github.com/weapp-vite/weapp-vite/commit/2d869640ad9775c48e07e905b92088bc7c7e1a2f)]:
  - @weapp-core/init@3.0.1

## 1.0.19

### Patch Changes

- Updated dependencies [[`fcf0e75`](https://github.com/weapp-vite/weapp-vite/commit/fcf0e75cb4ce73d4841676353a0b95d1d044db91), [`9f6a432`](https://github.com/weapp-vite/weapp-vite/commit/9f6a43229af6b6f57a05c35216660a025a83a547)]:
  - @weapp-core/init@3.0.0

## 1.0.19-alpha.0

### Patch Changes

- Updated dependencies [[`fcf0e75`](https://github.com/weapp-vite/weapp-vite/commit/fcf0e75cb4ce73d4841676353a0b95d1d044db91), [`9f6a432`](https://github.com/weapp-vite/weapp-vite/commit/9f6a43229af6b6f57a05c35216660a025a83a547)]:
  - @weapp-core/init@3.0.0-alpha.0

## 1.0.18

### Patch Changes

- Updated dependencies [[`576c8e1`](https://github.com/weapp-vite/weapp-vite/commit/576c8e1f5a143031ed3c321bf25a8e66a0d8c043), [`9f14216`](https://github.com/weapp-vite/weapp-vite/commit/9f142162dd7dc28a576e7f9617e4b57adfa59048)]:
  - @weapp-core/init@2.1.5

## 1.0.17

### Patch Changes

- [`9733680`](https://github.com/weapp-vite/weapp-vite/commit/9733680cbdcc2a54a9c89f5f50b2b0f951202745) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`9733680`](https://github.com/weapp-vite/weapp-vite/commit/9733680cbdcc2a54a9c89f5f50b2b0f951202745)]:
  - @weapp-core/init@2.1.4

## 1.0.16

### Patch Changes

- Updated dependencies [[`0e52d23`](https://github.com/weapp-vite/weapp-vite/commit/0e52d236e666753c76b8fb23cc65173b46d0cb8a), [`4a816f4`](https://github.com/weapp-vite/weapp-vite/commit/4a816f4c42084ef301f4c5b64f20595d7be8f62f)]:
  - @weapp-core/init@2.1.3

## 1.0.15

### Patch Changes

- Updated dependencies [[`3f0b3a2`](https://github.com/weapp-vite/weapp-vite/commit/3f0b3a2fb8dfbb83cd83e3b005ab3e9ccd2d4480)]:
  - @weapp-core/init@2.1.2

## 1.0.14

### Patch Changes

- Updated dependencies [[`d8523bb`](https://github.com/weapp-vite/weapp-vite/commit/d8523bbf20a22abe5399808060da8854d0cfe68e)]:
  - @weapp-core/init@2.1.1

## 1.0.13

### Patch Changes

- Updated dependencies [[`ef98c7d`](https://github.com/weapp-vite/weapp-vite/commit/ef98c7d5f4e7e9836f4e4c21ae80fae4581deb7a)]:
  - @weapp-core/init@2.1.0

## 1.0.12

### Patch Changes

- Updated dependencies [[`2144ba3`](https://github.com/weapp-vite/weapp-vite/commit/2144ba3b8ae4ffd753f4bef8dab1e15553ac01fb)]:
  - @weapp-core/init@2.0.10

## 1.0.11

### Patch Changes

- [`0cbd148`](https://github.com/weapp-vite/weapp-vite/commit/0cbd14877233fefd86720a818e1b9e79a7c3eb68) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持配置使用 jsonc 格式

## 1.0.10

### Patch Changes

- Updated dependencies [[`66a2df2`](https://github.com/weapp-vite/weapp-vite/commit/66a2df2c484666f4d715b0d450a7e0925e10a273), [`26e25bb`](https://github.com/weapp-vite/weapp-vite/commit/26e25bbcd71e834ad0d3791816cb90bd3deca122), [`6f4096e`](https://github.com/weapp-vite/weapp-vite/commit/6f4096e2a9fa0d7b287b2d07b42b58999d7caa7f)]:
  - @weapp-core/init@2.0.9

## 1.0.9

### Patch Changes

- Updated dependencies [[`c0137f1`](https://github.com/weapp-vite/weapp-vite/commit/c0137f1009b96a6d68555a54f5b64a843bfad431), [`40aa53d`](https://github.com/weapp-vite/weapp-vite/commit/40aa53dada7bf03096f6382964bf66253e2bd839)]:
  - @weapp-core/init@2.0.8

## 1.0.8

### Patch Changes

- [`9a2a21f`](https://github.com/weapp-vite/weapp-vite/commit/9a2a21f8c472aeb95a0192983275eddc85f5f37b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 1.0.7

### Patch Changes

- Updated dependencies [[`966853e`](https://github.com/weapp-vite/weapp-vite/commit/966853e32e2805bc5a4b372f72586c60955926f1)]:
  - @weapp-core/init@2.0.7

## 1.0.6

### Patch Changes

- Updated dependencies [[`b8e58c3`](https://github.com/weapp-vite/weapp-vite/commit/b8e58c38b0c95a2440601879e98511e08d90d821)]:
  - @weapp-core/init@2.0.6

## 1.0.5

### Patch Changes

- [`f1fd325`](https://github.com/weapp-vite/weapp-vite/commit/f1fd3250cfec6a508535618169de0f136ec5cbc2) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade 升级依赖版本

- Updated dependencies [[`f1fd325`](https://github.com/weapp-vite/weapp-vite/commit/f1fd3250cfec6a508535618169de0f136ec5cbc2), [`975ef00`](https://github.com/weapp-vite/weapp-vite/commit/975ef001277f596012ee115eb154140e41c19e72)]:
  - @weapp-core/init@2.0.5

## 1.0.4

### Patch Changes

- Updated dependencies [[`3af287e`](https://github.com/weapp-vite/weapp-vite/commit/3af287ea2d35b309d9891d02242d551ef14f3a2e)]:
  - @weapp-core/init@2.0.4

## 1.0.3

### Patch Changes

- Updated dependencies [[`4ef7c3d`](https://github.com/weapp-vite/weapp-vite/commit/4ef7c3d3480fce8f8c241f3e1e1238628313350d)]:
  - @weapp-core/init@2.0.3

## 1.0.2

### Patch Changes

- Updated dependencies [[`a59845c`](https://github.com/weapp-vite/weapp-vite/commit/a59845c085a2484a29dd19d51ebef5f48e875dc1), [`0ae2a53`](https://github.com/weapp-vite/weapp-vite/commit/0ae2a53198b8d3ab3e8a9ac18ee125e2017a8f51)]:
  - @weapp-core/init@2.0.2

## 1.0.1

### Patch Changes

- Updated dependencies []:
  - @weapp-core/init@2.0.1

## 1.0.0

### Major Changes

- [`5199d06`](https://github.com/weapp-vite/weapp-vite/commit/5199d06f3fc4b0162115004953a55d87746a4563) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 发布 create-weapp-vite 正式版本

### Patch Changes

- Updated dependencies [[`0fefeca`](https://github.com/weapp-vite/weapp-vite/commit/0fefeca50752fc33ecb5403072f0f863b04686ef), [`32738e9`](https://github.com/weapp-vite/weapp-vite/commit/32738e92712d650cdc7651c63114464170d159a4)]:
  - @weapp-core/init@2.0.0

## 0.0.13-beta.0

### Patch Changes

- Updated dependencies [[`0fefeca`](https://github.com/weapp-vite/weapp-vite/commit/0fefeca50752fc33ecb5403072f0f863b04686ef)]:
  - @weapp-core/init@2.0.0-beta.0

## 0.0.12

### Patch Changes

- Updated dependencies [[`8c61a0f`](https://github.com/weapp-vite/weapp-vite/commit/8c61a0fb12298b90cf0f0aeebcea8d42aa2afd3a)]:
  - @weapp-core/init@1.2.2

## 0.0.11

### Patch Changes

- Updated dependencies [[`a9c1c9e`](https://github.com/weapp-vite/weapp-vite/commit/a9c1c9e3ff5e7312effa85c3be92eb6647b07fcc)]:
  - @weapp-core/init@1.2.1

## 0.0.10

### Patch Changes

- Updated dependencies [[`1401bed`](https://github.com/weapp-vite/weapp-vite/commit/1401bedf00f722b1f03917b02481aafa456ac129)]:
  - @weapp-core/init@1.2.0

## 0.0.9

### Patch Changes

- Updated dependencies [[`e8d9e03`](https://github.com/weapp-vite/weapp-vite/commit/e8d9e03b9508eabde1a43245eecd3408a757413b)]:
  - @weapp-core/init@1.1.18

## 0.0.8

### Patch Changes

- Updated dependencies [[`ce411f5`](https://github.com/weapp-vite/weapp-vite/commit/ce411f5ca65be7a2457223dc493e7d3f30b771f0), [`3983ea5`](https://github.com/weapp-vite/weapp-vite/commit/3983ea552aa9b36ff4aea642aebc3f567d6e0a3d)]:
  - @weapp-core/init@1.1.17

## 0.0.7

### Patch Changes

- [`c70141a`](https://github.com/weapp-vite/weapp-vite/commit/c70141ab30b16b74e34055f2d6aff9f61332da81) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`4907eae`](https://github.com/weapp-vite/weapp-vite/commit/4907eae52e0c5f3399c1468a0688f69a99f61f95), [`c70141a`](https://github.com/weapp-vite/weapp-vite/commit/c70141ab30b16b74e34055f2d6aff9f61332da81)]:
  - @weapp-core/init@1.1.16

## 0.0.6

### Patch Changes

- [`a10af03`](https://github.com/weapp-vite/weapp-vite/commit/a10af03b0e85326cb9db344af6ebed027b1e5a89) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade deps

## 0.0.5

### Patch Changes

- [`4f72349`](https://github.com/weapp-vite/weapp-vite/commit/4f723498d7a4db28eba5a50f6fccda6b78a10020) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: change default template

- Updated dependencies [[`cac6148`](https://github.com/weapp-vite/weapp-vite/commit/cac6148819fb25f541e6d6b5edebcf33b935ae04), [`61c7e8b`](https://github.com/weapp-vite/weapp-vite/commit/61c7e8b1d7ea3c4f6c0fcb4dc73b016693d45204), [`ed79551`](https://github.com/weapp-vite/weapp-vite/commit/ed795512f7ddc9fbe0b2be5f67172257439ad7c2), [`4f72349`](https://github.com/weapp-vite/weapp-vite/commit/4f723498d7a4db28eba5a50f6fccda6b78a10020), [`8682d07`](https://github.com/weapp-vite/weapp-vite/commit/8682d07cb9e9fb34acf1ce8c38756d38c005cd35), [`f15117e`](https://github.com/weapp-vite/weapp-vite/commit/f15117e42630f2b2452fb55db2daa580b98ac0b4)]:
  - @weapp-core/init@1.1.15

## 0.0.5-alpha.5

### Patch Changes

- Updated dependencies [[`ed79551`](https://github.com/weapp-vite/weapp-vite/commit/ed795512f7ddc9fbe0b2be5f67172257439ad7c2)]:
  - @weapp-core/init@1.1.15-alpha.5

## 0.0.5-alpha.4

### Patch Changes

- Updated dependencies [[`f15117e`](https://github.com/weapp-vite/weapp-vite/commit/f15117e42630f2b2452fb55db2daa580b98ac0b4)]:
  - @weapp-core/init@1.1.15-alpha.4

## 0.0.5-alpha.3

### Patch Changes

- Updated dependencies [[`cac6148`](https://github.com/weapp-vite/weapp-vite/commit/cac6148819fb25f541e6d6b5edebcf33b935ae04)]:
  - @weapp-core/init@1.1.15-alpha.3

## 0.0.5-alpha.2

### Patch Changes

- Updated dependencies [[`8682d07`](https://github.com/weapp-vite/weapp-vite/commit/8682d07cb9e9fb34acf1ce8c38756d38c005cd35)]:
  - @weapp-core/init@1.1.15-alpha.2

## 0.0.5-alpha.1

### Patch Changes

- [`4f72349`](https://github.com/weapp-vite/weapp-vite/commit/4f723498d7a4db28eba5a50f6fccda6b78a10020) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: change default template

- Updated dependencies [[`4f72349`](https://github.com/weapp-vite/weapp-vite/commit/4f723498d7a4db28eba5a50f6fccda6b78a10020)]:
  - @weapp-core/init@1.1.15-alpha.1

## 0.0.5-alpha.0

### Patch Changes

- Updated dependencies [[`61c7e8b`](https://github.com/weapp-vite/weapp-vite/commit/61c7e8b1d7ea3c4f6c0fcb4dc73b016693d45204)]:
  - @weapp-core/init@1.1.15-alpha.0

## 0.0.4

### Patch Changes

- Updated dependencies [[`8ddfc97`](https://github.com/weapp-vite/weapp-vite/commit/8ddfc97a5706a25fa146b10fa43b7dc626a9f893)]:
  - @weapp-core/init@1.1.14

## 0.0.3

### Patch Changes

- Updated dependencies []:
  - @weapp-core/init@1.1.13

## 0.0.2

### Patch Changes

- [`6858172`](https://github.com/weapp-vite/weapp-vite/commit/6858172f22ef429374d6165390a2d1a018132441) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: create-weapp-vite allow select template

- Updated dependencies [[`c2f29a1`](https://github.com/weapp-vite/weapp-vite/commit/c2f29a15a651389175fbe7cb5c6e1644bcaafd1c), [`ea7be91`](https://github.com/weapp-vite/weapp-vite/commit/ea7be91e0d230b499691ae75239659c4586346af)]:
  - @weapp-core/init@1.1.12

## 0.0.1

### Patch Changes

- Updated dependencies [[`5735e56`](https://github.com/weapp-vite/weapp-vite/commit/5735e5651a793611489afbbd7982241b6792f8fc)]:
  - @weapp-core/init@1.1.11
