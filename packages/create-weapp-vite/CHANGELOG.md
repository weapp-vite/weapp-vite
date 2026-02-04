# create-weapp-vite

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
