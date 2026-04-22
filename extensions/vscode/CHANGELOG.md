# 更新日志

## 0.2.4

### Patch Changes

- 🐛 **为 VS Code 扩展补上独立 `wxml` 文件的格式化能力：现在扩展会为 `wxml` 注册 document formatter，并委托 VS Code 内置 HTML formatter 输出格式化结果，同时补充 activation、smoke 与格式化委托测试，避免后续发布回归。** [#497](https://github.com/weapp-vite/weapp-vite/pull/497) by @sonofmagic

## 0.2.3

### Patch Changes

- 🐛 **修复 VS Code 扩展在 monorepo 中解析 rooted `usingComponents` 时的误报。现在当子项目使用 `app.config.*` 而不是 `app.json` 时，扩展会基于最近的 `weapp-vite` 项目根定位组件文件，不再把 `/native/...` 这类路径错误地解析到当前 `.vue` 文件目录下。** [`c41a4ec`](https://github.com/weapp-vite/weapp-vite/commit/c41a4ec07721e95f475ace2e9ff78c439c37734f) by @sonofmagic

## 0.2.2

### Patch Changes

- 🐛 **修复 VSCode 扩展相关回归测试在 Windows CI 下的路径与命令兼容性问题，避免发布前校验被平台差异误拦截。** [#472](https://github.com/weapp-vite/weapp-vite/pull/472) by @sonofmagic

- 🐛 **修复 VS Code 扩展在独立检查环境下缺少 `@weapp-vite/ast` 依赖导致模板增强测试无法解析 AST 模块的问题，并补齐跨平台 URI mock 的测试覆盖。** [#477](https://github.com/weapp-vite/weapp-vite/pull/477) by @sonofmagic

## 0.2.1

### Patch Changes

- 🐛 **为 VS Code 扩展补充一次 patch changeset，确保后续 release PR 会递增扩展版本，并重新触发 Marketplace 发布流程。** [`c7eb853`](https://github.com/weapp-vite/weapp-vite/commit/c7eb853ce93b85fa5dc5759b1aa8ea58a5ed3d28) by @sonofmagic

## 0.2.0

### Minor Changes

- ✨ **增强 VS Code 扩展的 WXML 与 weapp-vite 模板开发体验：新增 WXML 语言支持，并完善原生组件、本地组件与原生自定义组件的元数据提取、补全、Hover、条件属性展示、标签/属性/事件预览、定义跳转、引用查询、重命名、链接跳转、模板变量装饰与标签高亮能力；同时拆分 `.vue <template>` 与独立 `.wxml` 的增强开关，补充安装态 `.vsix` 真实宿主 e2e 校验并修复真实 VS Code 宿主中的激活兼容问题。相关模板初始化能力也随原生组件条件补全一起同步更新到 `create-weapp-vite`。** [`cd33619`](https://github.com/weapp-vite/weapp-vite/commit/cd336193b4cd6c7002e574d1eeb9031c14755484) by @sonofmagic

### Patch Changes

- 🐛 **为 VS Code 扩展补上独立 `.wxml` 文件的 Explorer 图标映射与更接近 HTML 文件图标的视觉样式，并保留 `weapp-vite File Icons` 的手动启用能力：现在用户可按需切换到该文件图标主题，让 `weapp-vite.config.*` 显示专属图标、`index.wxml` 等 WXML 文件显示更清晰的折角文件图标；同时安装态 smoke / VSIX 校验会覆盖对应资源与启动配置，避免发布后再次出现图标缺失。** [`0ea8330`](https://github.com/weapp-vite/weapp-vite/commit/0ea83302c921ccda7ec422f04321a2686731fa9b) by @sonofmagic

- 🐛 **修复 VS Code 扩展对 `weapp-vite.config.*` 的识别与激活链路：现在工作区仅存在 `weapp-vite.config.ts`、`weapp-vite.config.mts`、`weapp-vite.config.cts`、`weapp-vite.config.js`、`weapp-vite.config.mjs` 或 `weapp-vite.config.cjs` 时，也会触发扩展激活，并让配置文件补全、悬浮、项目探测与关键文件跳转保持一致；同时补齐 `vite.config.cts` / `vite.config.cjs` 的 manifest 激活覆盖，减少配置文件命名或后缀不同导致的能力缺失。** [`4dbde4b`](https://github.com/weapp-vite/weapp-vite/commit/4dbde4b0cd66dc8f98eb69f90042e63fdefabd26) by @sonofmagic

- 🐛 **修复 VS Code 扩展对常用 `weapp-vite` 脚本的缺失诊断与自动补齐逻辑：现在会按命令候选名识别已有脚本，例如 `scripts.g = "weapp-vite generate"` 或 `scripts["dev:open"] = "wv dev --open"` 不会再被误判为缺少 `generate` / `dev`，插入常用脚本时也不会重复补出等价命令。** [`bc4ddc3`](https://github.com/weapp-vite/weapp-vite/commit/bc4ddc39513b318bf8beb81fe36083887bcdcc3e) by @sonofmagic

- 🐛 **调整 VS Code 扩展对 `package.json` 常用脚本建议的呈现方式：不再把“建议补齐常用 weapp-vite 脚本”作为 Problems 诊断展示，避免在问题面板里产生噪音；相关补齐能力仍保留为按需触发的 Quick Fix，并且只会在确认缺少常用脚本时出现。** [`e3819eb`](https://github.com/weapp-vite/weapp-vite/commit/e3819eb25c0d3471ba8c4b79b5209e4bfb20c7d3) by @sonofmagic

- 🐛 **收敛 VS Code 扩展中的页面配置工作流，新增页面与模板入口默认只推荐 `definePageJson`，不再把 `<json>` 双写同步、配置漂移筛选和相关快捷命令作为常规能力暴露；同时保留对历史 `<json>` 页面文件的兼容解析，并在同页同时存在 `definePageJson` 与 `<json>` 时给出兼容提示，帮助项目逐步迁移到单一的 `definePageJson` 配置写法。** [`b969584`](https://github.com/weapp-vite/weapp-vite/commit/b969584ac93c269272394a7ae83b5edc3bbbc144) by @sonofmagic

- 🐛 **修复 VS Code 扩展在独立检查环境下缺少 `@weapp-vite/ast` 依赖导致模板增强测试无法解析 AST 模块的问题，并补齐跨平台 URI mock 的测试覆盖。** [#467](https://github.com/weapp-vite/weapp-vite/pull/467) by @sonofmagic

## 0.1.3

### Patch Changes

- 🐛 **优化 VS Code 扩展的配置文件图标体验，并将扩展构建切换为 ESM 产物，同时移除运行时对 TypeScript 编译器的静态依赖，显著缩小打包后的 VSIX 体积。** [`5f7daab`](https://github.com/weapp-vite/weapp-vite/commit/5f7daab5366130216db920c4ceb3e302f4fb985e) by @sonofmagic

## 0.1.2

### Patch Changes

- 🐛 **改进 VS Code 扩展的 weapp-vite 项目体验：修复 `package.json` 常用脚本诊断误报，只在能确认当前目录确实是 weapp-vite 项目时才提示补齐脚本；同时把 `Generate` 改为扩展内置的页面 / 组件 `.vue` 骨架生成能力，不再依赖 `wv` CLI，支持读取 `vite.config.*` 中常见的 `weapp.generate.dirs` / `filenames` 配置，并新增资源管理器目录右键创建页面 / 组件入口，以及页面生成后直接加入 `app.json`、批量同步未注册页面到 `app.json`、批量补齐 `app.json` 已声明但文件缺失页面的交互；当已声明页面文件或页面目录在资源管理器中被重命名、移动或删除时，扩展也会自动同步更新 `app.json` 中的页面路由，并在 route 已无其他候选页面文件时自动清理失效声明；此外，扩展现在也会识别 `.vue` 文件 `<json>` 里的 `usingComponents` 本地组件路径，为缺失组件给出诊断、悬浮解析信息，并支持直接创建缺失组件骨架；对于已存在的本地组件路径，也支持 `Cmd/Ctrl + Click` 直接跳转到组件文件；当本地组件文件或组件目录在资源管理器中被重命名、移动或删除时，扩展还会自动同步更新或清理引用它们的 `usingComponents` 路径，避免残留失效组件引用；同时新增项目级修复入口，可集中扫描并批量处理缺失页面、未注册页面和缺失组件。** [#461](https://github.com/weapp-vite/weapp-vite/pull/461) by @sonofmagic

## 0.1.1

### Patch Changes

- 🐛 **修复 VS Code 插件发布计划仅比较上一个提交版本的问题，改为直接比较仓库当前版本与 Marketplace 线上版本。这样当某次首次发布失败后，只要线上版本仍然落后，后续成功的 release workflow 仍会自动补发对应版本。** [`d07671d`](https://github.com/weapp-vite/weapp-vite/commit/d07671dcb18e63ed2d451b153727ce693a516186) by @sonofmagic

- 🐛 **修复 VS Code 插件发布临时 manifest 仍携带 `devDependencies`、`scripts` 和 `private` 字段的问题，避免 `vsce` 在发布阶段错误地拿开发依赖参与引擎版本校验，导致 Marketplace 自动发布失败。** [`e67c573`](https://github.com/weapp-vite/weapp-vite/commit/e67c573ad76437d617ec89517b34384567062b31) by @sonofmagic

## 0.1.0

### Minor Changes

- ✨ **VS Code 扩展现在会在页面同时使用 `definePageJson` 与 `<json>` 且关键页面配置不一致时给出诊断提示，帮助更早发现双写页面配置时的同步遗漏问题。** [`16614f4`](https://github.com/weapp-vite/weapp-vite/commit/16614f4f1796ff90b6bbffacbc243a33df1c2063) by @sonofmagic

- ✨ **VS Code 扩展现在支持在 `app.json` 中将已存在页面的 route 识别为可点击链接，可通过 `Cmd/Ctrl + Click` 直接跳转到对应页面文件，进一步减少从页面声明到源码之间的手动查找成本。** [`a1ef9f3`](https://github.com/weapp-vite/weapp-vite/commit/a1ef9f3f54347d04846ed5c01341126ab4d85d04) by @sonofmagic

- ✨ **VS Code 扩展现在会检查页面 `definePageJson` 与 `<json>` 中的 `enablePullDownRefresh` 是否一致，并提供双向同步 quick fix。这样布尔类页面配置在双写场景下也能直接补齐和修正，减少页面行为配置漂移。** [`eca97e9`](https://github.com/weapp-vite/weapp-vite/commit/eca97e9a32f5f9c6bc173b094c704eb3a462a285) by @sonofmagic

- ✨ **VS Code 扩展现在支持在页面 `.vue` 的 `definePageJson({...})` 中补全常用页面字段，让脚本配置写法也能获得和 `<json>` 自定义块一致的页面配置补全体验。** [`c8b937d`](https://github.com/weapp-vite/weapp-vite/commit/c8b937d515f1b67111cfb1d33f23ef52548288ff) by @sonofmagic

- ✨ **VS Code 扩展现在会在页面 `.vue` 已能识别为页面文件但尚未声明到 `app.json` 时，直接在当前页面给出诊断提示，并只在这类页面上显示 `Add Current Page To app.json` 的补齐操作，减少普通组件中的无关提示。** [`3caec2c`](https://github.com/weapp-vite/weapp-vite/commit/3caec2c6f0a8771bd71f70c4ffa2866d38b89dde) by @sonofmagic

- ✨ **VS Code 扩展现在支持在页面标题双写场景中自动补齐缺失的一侧配置。无论是 `<json>` 缺少 `navigationBarTitleText`，还是 `definePageJson` 缺少该字段，都可以直接通过现有同步 quick fix 一步补齐。** [`d5327bd`](https://github.com/weapp-vite/weapp-vite/commit/d5327bd7f7cc8213e18e8b9e9c719aecdeea16e8) by @sonofmagic

- ✨ **VS Code 扩展现在支持在页面 `.vue` 中为 `definePageJson` 及常用页面配置键提供 hover 说明，帮助开发者在脚本配置写法下更快理解字段用途而无需反复查阅文档。** [`3137c17`](https://github.com/weapp-vite/weapp-vite/commit/3137c17e8f98ff338b1a6d68d49faee0be8e8192) by @sonofmagic

- ✨ **VS Code 扩展现在会为 `weapp-vite Pages` 视图中的当前问题页面提供更直接的行内修复动作。当前页如果缺少页面文件，可直接在树节点上创建页面；如果页面文件存在但尚未声明到 `app.json`，也可直接在树节点上补齐声明，减少只为修一个当前页面问题而打开右键菜单的操作成本。** [`d33bb5d`](https://github.com/weapp-vite/weapp-vite/commit/d33bb5d2f5b7400a972eebdc710e1e999349e1d3) by @sonofmagic

- ✨ **VS Code 扩展现在支持在 `app.json` 的已存在页面 route 上直接执行 `Open Page From Route`，无需手动搜索页面文件即可从页面声明一跳进入对应页面源码。** [`21213f1`](https://github.com/weapp-vite/weapp-vite/commit/21213f1a9b6901cba04eb6d8e95636a5f4b27117) by @sonofmagic

- ✨ **VS Code 扩展现在支持在页面 `.vue` 的 `definePageJson({...})` 与 `<json>` 页面配置中补全常用枚举值和布尔值，例如 `navigationStyle`、`backgroundTextStyle`、`enablePullDownRefresh` 与 `disableScroll`，进一步减少页面配置手写成本。** [`e5bb55f`](https://github.com/weapp-vite/weapp-vite/commit/e5bb55fbc58852d9441f336ca2297405d0472e0d) by @sonofmagic

- ✨ **VS Code 扩展现在会同时检查页面 `definePageJson` 与 `<json>` 中的 `navigationStyle` 是否一致，并提供双向同步 quick fix。无论是配置值不一致，还是某一侧缺少该字段，都可以直接在页面里完成补齐与同步。** [`eee02a8`](https://github.com/weapp-vite/weapp-vite/commit/eee02a809f6f6c3b0db6d80403ef3dec80a4946e) by @sonofmagic

- ✨ **VS Code 扩展现在会为 `weapp-vite Pages` 视图中的当前页面节点提供更直接的快捷动作入口。当前页节点会带上独立状态上下文，并以内联方式暴露复制 route、定位 `app.json` 以及配置漂移同步等常用操作；同时新增“定位当前页面到 Pages 视图”命令与标题栏入口，在树视图刷新后也能稳定重新聚焦当前页面，减少从树视图切换到命令面板或编辑器上下文的次数。** [`246ceb4`](https://github.com/weapp-vite/weapp-vite/commit/246ceb4c4de3fec1e163e406d15582e8a5b9f457) by @sonofmagic

- ✨ **VS Code 扩展现在支持在 `weapp-vite Pages` 侧边栏中直接修复页面配置漂移。对存在 `definePageJson` 与 `<json>` 不一致的页面节点，可以右键整页同步任一方向，一次性把常用页面字段修正到一致状态。** [`1ce380f`](https://github.com/weapp-vite/weapp-vite/commit/1ce380f9697677e2572a3ec71f31fcc472619fc3) by @sonofmagic

- ✨ **VS Code 扩展现在支持在页面标题双写不一致时提供双向 quick fix，不仅可以将 `<json>` 的 `navigationBarTitleText` 同步为 `definePageJson`，也可以反向将 `definePageJson` 同步为 `<json>`，让页面配置修复流程更完整。** [`db14d21`](https://github.com/weapp-vite/weapp-vite/commit/db14d2163e5dd20d4fd4f2827de0b24e0661068b) by @sonofmagic

- ✨ **VS Code 扩展中的 `Run Action` 现在会根据当前页面上下文优先展示页面相关操作，并直接提示当前 route 与声明状态，减少页面开发时在通用命令里反复筛选。** [`9309d37`](https://github.com/weapp-vite/weapp-vite/commit/9309d3755fd75d34c0ff06898ba2bf9623ccc749) by @sonofmagic

- ✨ **VS Code 扩展现在会让 `weapp-vite Pages` 侧边栏自动跟随当前活动页面，并在树节点上标记当前页面与页面状态。开发者切换页面时可以直接在侧边栏看到当前定位，同时区分正常页面、缺失页面和未声明页面。** [`9dcc24e`](https://github.com/weapp-vite/weapp-vite/commit/9dcc24e19448f4b757059101f6143ce7fb84ef92) by @sonofmagic

- ✨ **VS Code 扩展现在支持在 `app.json` 的页面 route 上显示 hover，直接提示当前 route 对应页面文件是否存在，并展示扩展尝试匹配的页面文件路径，便于快速排查页面声明与文件路径不一致的问题。** [`40b6a22`](https://github.com/weapp-vite/weapp-vite/commit/40b6a226b292cdb7067cf788e58666ff7aeee22d) by @sonofmagic

- ✨ **VS Code 扩展现在会在检测到 `definePageJson` 与 `<json>` 的页面标题配置不一致时提供 quick fix，可直接将 `<json>` 中的 `navigationBarTitleText` 同步为 `definePageJson` 的值，减少双写配置时的手动修正成本。** [`a555dfe`](https://github.com/weapp-vite/weapp-vite/commit/a555dfe43f7d69e0b5d5cfbb01bd5add2ca94525) by @sonofmagic

- ✨ **VS Code 扩展现在会以更细化的复合状态展示 `weapp-vite Pages` 侧边栏中的页面节点。缺失页面、未声明页面、配置漂移页面和当前页面会按优先级组合显示在节点描述、图标和排序中，帮助开发者更快定位最需要处理的问题页面。** [`0f0eb0b`](https://github.com/weapp-vite/weapp-vite/commit/0f0eb0b1793fb77535ff8c46fe87908c76ebb75f) by @sonofmagic

- ✨ **VS Code 扩展现在支持在 `weapp-vite Pages` 侧边栏视图中直接执行页面修复动作。可以对树节点右键创建缺失页面、把未声明页面加入 `app.json`、定位到页面声明位置以及复制页面 route，让页面结构维护不再依赖当前活动编辑器。** [`f66dc20`](https://github.com/weapp-vite/weapp-vite/commit/f66dc202b097aa994d635fe9df9aa9acefa83ccb) by @sonofmagic

- ✨ **VS Code 扩展新增了 `weapp-vite Pages` Explorer 视图，可以按顶层页面、分包页面和未声明页面浏览项目页面结构。点击页面节点即可直接打开对应页面文件，若 `app.json` 已声明但页面文件缺失，则会直接打开 `app.json` 方便继续修复。** [`7d947f9`](https://github.com/weapp-vite/weapp-vite/commit/7d947f99e0483c8a305002ee6cb61641564e65ac) by @sonofmagic

- ✨ **VS Code 扩展现在为 `weapp-vite Pages` 视图提供问题聚焦筛选能力。开发者可以直接在标题栏切换“仅问题页”“仅当前页”“仅配置漂移页”，并一键清除筛选，让页面排查与修复更适合中大型项目的日常工作流。** [`77920b5`](https://github.com/weapp-vite/weapp-vite/commit/77920b5b8d8fe7aa38fca63dbec70dc55ee1731a) by @sonofmagic

- ✨ **VS Code 扩展现在为 `weapp-vite Pages` 视图提供独立刷新命令和标题栏入口。开发者在手动修改 `app.json`、新增页面文件或调整分包结构后，可以直接在侧边栏重建页面树，并自动重新同步当前页面定位，减少等待编辑器事件触发或来回切换文件的成本。** [`9318f90`](https://github.com/weapp-vite/weapp-vite/commit/9318f909757acfd8150184e949b4fb635ab8057e) by @sonofmagic

- ✨ **VS Code 扩展现在会在 `weapp-vite Pages` 侧边栏中直接标记页面配置漂移状态。当页面 `definePageJson` 与 `<json>` 的常用字段不一致时，页面节点会显示配置漂移提示，方便在页面结构视图里同时发现配置问题。** [`1a2c8e5`](https://github.com/weapp-vite/weapp-vite/commit/1a2c8e5a73da766c36ae59f43a16750379629784) by @sonofmagic

### Patch Changes

- 🐛 **为 VS Code 扩展新增页面 `<json>` 自定义块字段补全：在 `.vue` 中编辑页面 JSON 配置时，可直接补全 `navigationBarTitleText`、`enablePullDownRefresh`、`backgroundColor` 等常用字段，减少手动输入与记忆成本。** [`0ff1a0c`](https://github.com/weapp-vite/weapp-vite/commit/0ff1a0c2b6d3fe3110be4697b7eeebf87523d2a6) by @sonofmagic

- 🐛 **为 VS Code 扩展新增 `app.json` 页面声明诊断：当 `pages`、`subPackages` 或 `subpackages` 中声明的页面在项目内找不到对应 `.vue`、`.ts`、`.js` 或 `.wxml` 文件时，编辑器会直接给出提示，帮助更早发现页面路径拼写错误或遗漏文件的问题。** [`de6dee0`](https://github.com/weapp-vite/weapp-vite/commit/de6dee0d2478b67954974c00e9e788a35d425e43) by @sonofmagic

- 🐛 **为 VS Code 扩展新增 `Create Page From Route` 修复动作：在 `app.json` 的缺失页面路由上可直接生成对应的 `.vue` 页面文件骨架，并自动打开新文件，减少从诊断提示到补齐页面的手工操作。** [`f00e5c5`](https://github.com/weapp-vite/weapp-vite/commit/f00e5c587054140706df6685b1c2ce375e4f5105) by @sonofmagic

- 🐛 **VS Code 扩展现在会在 `weapp-vite Pages` 视图的筛选结果为空时显示明确的空状态节点，并支持直接点击清除筛选。这样在使用“仅问题页”或“仅配置漂移页”等聚焦模式时，不会再因为树视图完全空白而难以判断当前状态。** [`7588862`](https://github.com/weapp-vite/weapp-vite/commit/758886219fec0508d49ae7869248cbc21631b09f) by @sonofmagic

- 🐛 **为 VS Code 扩展新增 `Open Project File` 导航命令，可在识别到的 `weapp-vite` 工作区内快速打开 `package.json`、`vite.config.*`、`app.json` 以及 `app.json` 中声明的页面文件，减少在项目入口配置和页面源码之间手动查找与切换的成本。** [`c1af93d`](https://github.com/weapp-vite/weapp-vite/commit/c1af93d01c45c33943ca54c67c59cff70477e993) by @sonofmagic

- 🐛 **为 VS Code 扩展新增当前页面路由操作：可直接从当前页面文件复制 page route，或跳转到 `app.json` 中对应的页面声明位置，减少在页面源码与小程序路由配置之间来回搜索的成本。** [`7d822d7`](https://github.com/weapp-vite/weapp-vite/commit/7d822d79c55913b29d20a0d8cc21c9fd5792d3bd) by @sonofmagic

- 🐛 **为 VS Code 扩展增强 `vite.config.*` 补全：编辑器会根据当前所处的配置层级补全 `weapp`、`generate`、`dirs`、`extensions`、`filenames` 等常用字段和骨架，减少手动查模板与重复输入的成本。** [`63bdc71`](https://github.com/weapp-vite/weapp-vite/commit/63bdc714ad53d80ca52f4b4b6cfe743387065f21) by @sonofmagic

- 🐛 **为 VS Code 扩展新增 `Insert definePageJson Template` 命令，并在 Vue 页面 code action 中提供对应入口，可直接插入 `definePageJson(...)` 基础骨架，减少页面配置样板代码的重复输入。** [`0e55227`](https://github.com/weapp-vite/weapp-vite/commit/0e55227858c7c73266a3e4985efe29a55d736def) by @sonofmagic

- 🐛 **优化 VS Code 扩展在 Vue 页面中的页面配置 code action：当文件已经存在 `definePageJson(...)` 或 `<json>` 自定义块时，不再重复提示对应插入动作，仅在缺失时提供更明确的补齐入口，减少无效建议干扰。** [`950b37a`](https://github.com/weapp-vite/weapp-vite/commit/950b37ac1715efd5e4997c973f8d43b32752d778) by @sonofmagic

- 🐛 **为 VS Code 扩展新增 `app.json` 页面路径补全：在顶层 `pages` 和 `subPackages` / `subpackages` 的页面数组中，编辑器会根据项目内已有页面文件补全 route，并在分包场景下自动使用相对 `root` 的路径写法。** [`7753dcc`](https://github.com/weapp-vite/weapp-vite/commit/7753dccbe5584cb730e9caeac3d5785225d1c14d) by @sonofmagic

- 🐛 **为 VS Code 扩展新增 `Add Current Page To app.json` 动作：可直接把当前页面文件对应的 route 写入 `app.json`，并自动根据已有分包 `root` 判断写入顶层 `pages` 还是对应分包的 `pages` 数组。** [`09d4830`](https://github.com/weapp-vite/weapp-vite/commit/09d48305915a34c7b857b7a0115da7e4d463decb) by @sonofmagic

## 0.0.5

### Patch Changes

- 🐛 **收紧 VS Code 扩展对 weapp-vite 项目的识别条件，不再把 `create-weapp-vite` 依赖当作正式项目识别信号，避免把脚手架包误判为业务项目依赖。** [`2592666`](https://github.com/weapp-vite/weapp-vite/commit/2592666e52fe2f115dbab09855e8c39e87e5f6b3) by @sonofmagic

- 🐛 **将 VS Code 扩展发布流程合并到仓库统一的 changeset release 流程中：扩展版本由 changeset 驱动更新，合并 release PR 后自动发布到 VS Code Marketplace，但不会发布到 npm。** [`e025c8a`](https://github.com/weapp-vite/weapp-vite/commit/e025c8adcdbd5056fa31c38c05648b957b243f12) by @sonofmagic

- 🐛 **优化 VS Code 插件在 Marketplace 详情页中的展示信息：补充中文简介、官方入口链接与更完整的功能说明，方便用户在安装前快速了解扩展用途与文档入口。** [`3a64b6e`](https://github.com/weapp-vite/weapp-vite/commit/3a64b6e8452a55eb74c3973d0bb1fc444b9a146b) by @sonofmagic

## Unreleased

- 收紧项目识别条件，不再把 `create-weapp-vite` 依赖视为 weapp-vite 项目信号。
- 优化 VS Code Marketplace 详情页信息，补充中文简介、官方入口与更完整的扩展说明。
- 新增工作区识别、状态栏入口、输出面板和统一动作选择器。
- 新增 `dev`、`build`、`generate`、`open`、`doctor/info` 等实用命令。
- 新增 `<json>` 自定义块和 `defineConfig` 代码片段。
- 新增编辑器代码操作、Vue `<json>` 自定义块补全，以及 `package.json` 脚本诊断。
- 新增面向 `package.json`、`vite.config` 和 Vue 自定义块的轻量悬浮提示、上下文补全和文档快捷入口。
- 新增状态栏、诊断、悬浮、补全和 CLI 别名偏好的扩展配置项。
- 新增针对脚本建议与命令解析行为的纯逻辑测试。
- 新增 manifest 校验测试、面向发布的打包文件清单、命令面板可见性规则，以及首次使用说明。
- 从 VSIX 打包中排除测试文件，并新增发布前打包检查。
- 新增用于本地 CI 与发版门禁的独立包校验脚本。
- 新增扩展专用的 GitHub Actions CI 工作流。
- 新增可在本地和 CI 复用的 VSIX dry-run 打包脚本。
- 新增面向 VS Code Marketplace 的手动发布工作流和发布脚本。
- 将扩展运行时、单元测试和包脚本迁移到 TypeScript，并使用编译后的 `dist/` 作为入口。
- 将扩展运行时构建从 `tsc` 输出切换为 `tsdown` 打包，同时保持 TypeScript 测试流程不变。
- 新增编译产物 smoke test，以及独立的 VSIX 归档校验脚本，以提升打包安全性。

## 0.0.1

- 初始版本：默认将 `.vue` 中的 `<json>` 自定义块按 JSONC 高亮。
