# @weapp-core/init

## 6.0.1

### Patch Changes

- 🐛 **完善中文 JSDoc 与类型提示，提升 dts 智能提示体验。** [`f2d613f`](https://github.com/weapp-vite/weapp-vite/commit/f2d613fcdafd5de6bd145619f03d12b0b465688f) by @sonofmagic
- 📦 **Dependencies** [`f2d613f`](https://github.com/weapp-vite/weapp-vite/commit/f2d613fcdafd5de6bd145619f03d12b0b465688f)
  → `@weapp-core/logger@3.0.3`, `@weapp-core/shared@3.0.1`

## 6.0.0

### Major Changes

- 🚀 **改为纯 ESM 产物，移除 CJS 导出，并将 Node 引擎版本提升至 ^20.19.0 || >=22.12.0。** [`eeca173`](https://github.com/weapp-vite/weapp-vite/commit/eeca1733e3074d878560abdb5b3378021dc02eda) by @sonofmagic
  - `vite.config.ts` 等配置请统一使用 ESM 写法，避免 `__dirname`/`require` 这类 CJS 语法。
  - `loadConfigFromFile` 在遇到 CJS 写法导致加载失败时，应提示：`XXX` 为 CJS 格式，需要改为 ESM 写法（可参考 `import.meta.dirname` 等用法）。

### Patch Changes

- 📦 **Dependencies** [`eeca173`](https://github.com/weapp-vite/weapp-vite/commit/eeca1733e3074d878560abdb5b3378021dc02eda)
  → `@weapp-core/logger@3.0.0`, `@weapp-core/shared@3.0.0`

## 5.0.1

### Patch Changes

- 🐛 **chore(deps): upgrade** [`e1e1db3`](https://github.com/weapp-vite/weapp-vite/commit/e1e1db36bcbd7f450473825a999a5976bc8015b8) by @sonofmagic

## 5.0.0

### Major Changes

- 🚀 **## 变更说明** [`efa28eb`](https://github.com/weapp-vite/weapp-vite/commit/efa28ebddba79c054f98f594181b5844a0042eaa) by @sonofmagic
  - `weapp-vite` CLI 移除 `create` 命令；新项目创建请使用 `create-weapp-vite`（例如 `pnpm create weapp-vite`）。
  - `@weapp-core/init` 仅保留“初始化配置文件”相关能力（如 `initConfig`），不再包含模板项目创建能力。
  - 模板同步与模板创建逻辑迁移到 `create-weapp-vite`，并对外导出 `createProject` / `TemplateName`。

## 4.1.1

### Patch Changes

- 🐛 **chore: sync templates** [`c02b412`](https://github.com/weapp-vite/weapp-vite/commit/c02b41283cb4862891e85750b72c9937a339f4fe) by @sonofmagic

## 4.1.0

### Minor Changes

- ✨ **新增 `wevu-tdesign` 模板可选项（对应 `templates/weapp-vite-wevu-tailwindcss-tdesign-template`），可通过 `@weapp-core/init` 与 `create-weapp-vite` 选择创建。** [`802a189`](https://github.com/weapp-vite/weapp-vite/commit/802a1891a555b95d0efc4f0e6393758d536aad76) by @sonofmagic

## 4.0.1

### Patch Changes

- 🐛 **### weapp-vite** [`78e8ab8`](https://github.com/weapp-vite/weapp-vite/commit/78e8ab8c4f923a138c4216933186853fd8b81f63) by @sonofmagic
  - `autoImportComponents.resolvers` 新增支持 **对象写法**（推荐），同时保持对历史 **函数写法** 的兼容。
  - 内置 `VantResolver` / `TDesignResolver` / `WeuiResolver` 已切换为对象 resolver：优先走 `resolve()` / `components`，再回退到函数 resolver。
  - 第三方组件库 props 元数据解析从硬编码迁移为 resolver 自描述（`resolveExternalMetadataCandidates`），并加入候选路径的启发式兜底。

  > 注意：如果你此前在业务代码里直接调用内置 resolver（例如 `VantResolver()('van-button', ...)`），现在应改为交给 weapp-vite 处理，或自行调用 `resolver.resolve(...)`。

  ### @weapp-core/init
  - 修复单测依赖：在测试启动阶段同步生成 `templates/`，并加入锁防止并发同步导致的偶发失败。

## 4.0.0

### Major Changes

- 🚀 **## sync-wevu-version-in-init** [`488f8c4`](https://github.com/weapp-vite/weapp-vite/commit/488f8c4e62dcbd58a5b6823d97992680d077e4f7) by @sonofmagic
  - ## createProject 同步 wevu 版本
  - 在创建项目并更新 `weapp-vite` 版本的同时，如果模板的 `dependencies` 或 `devDependencies` 中存在 `wevu`，则会一并将其版本更新为当前仓库的 `wevu` 版本，避免版本不一致。
  - ## zh-volar-plugin-initializer
  - 在初始化模板时为 `tsconfig.app.json` 预置 `vueCompilerOptions.plugins: ["weapp-vite/volar"]`，新项目默认启用 Volar 配置块智能提示。

## 3.0.8-alpha.1

### Patch Changes

- 🐛 **## createProject 同步 wevu 版本** [`b34b972`](https://github.com/weapp-vite/weapp-vite/commit/b34b972610bbceb7ed1ad1e9dddb689b0909390e) by @sonofmagic
  - 在创建项目并更新 `weapp-vite` 版本的同时，如果模板的 `dependencies` 或 `devDependencies` 中存在 `wevu`，则会一并将其版本更新为当前仓库的 `wevu` 版本，避免版本不一致。

## 3.0.8-alpha.0

### Patch Changes

- [`9d4a8bd`](https://github.com/weapp-vite/weapp-vite/commit/9d4a8bd8b9d29274f9d3a75eaa20bfec27593e59) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 在初始化模板时为 `tsconfig.app.json` 预置 `vueCompilerOptions.plugins: ["weapp-vite/volar"]`，新项目默认启用 Volar 配置块智能提示。

## 3.0.7

### Patch Changes

- [`a876ddb`](https://github.com/weapp-vite/weapp-vite/commit/a876ddb9f35757093f2d349c2a9c70648c278c44) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 3.0.6

### Patch Changes

- [`fe93e13`](https://github.com/weapp-vite/weapp-vite/commit/fe93e13467c8a0db1fc7a24f438bcf7777862c82) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade deps

## 3.0.5

### Patch Changes

- [`ec736cd`](https://github.com/weapp-vite/weapp-vite/commit/ec736cd433fa344c7d10a96efe8af4ee899ba36b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复 @weapp-core/init 的单元测试与 lint 问题：去掉脆弱快照、补足覆盖率并按 eslint/ts 规范整理导入和辅助函数顺序。

## 3.0.4

### Patch Changes

- [`965f0c8`](https://github.com/weapp-vite/weapp-vite/commit/965f0c899e42af7fab45a6f5e3a6a64c946d72ec) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 3.0.3

### Patch Changes

- [`8bdcc85`](https://github.com/weapp-vite/weapp-vite/commit/8bdcc858b2f967c4b96ec997536c0ad5c8157aa7) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: update template

## 3.0.2

### Patch Changes

- [`38b486d`](https://github.com/weapp-vite/weapp-vite/commit/38b486d05d81fc5635a449f611fa2e6131af7823) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - 使用 `fdir` 扫描自动路由候选并缓存共享样式结果，减少多余 IO 和重复预处理。
  - 优化模板创建时的文件读写路径检测，避免额外的文件状态查询。

## 3.0.1

### Patch Changes

- [`2d86964`](https://github.com/weapp-vite/weapp-vite/commit/2d869640ad9775c48e07e905b92088bc7c7e1a2f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 更新模板

## 3.0.0

### Major Changes

- [`fcf0e75`](https://github.com/weapp-vite/weapp-vite/commit/fcf0e75cb4ce73d4841676353a0b95d1d044db91) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - 将 init 入口拆分为项目配置、包初始化、配置文件生成、模板创建等独立模块，保持对外 API 不变
  - 新增通用的文件与路径工具、健壮的 npm 版本解析，以及非破坏式的 .gitignore 合并，提升项目初始化可靠性
  - 发布时自动将模板内的 `.gitignore` 重命名为 `gitignore`，并在项目生成后恢复为 `.gitignore`，确保忽略规则正确下发

### Patch Changes

- [`9f6a432`](https://github.com/weapp-vite/weapp-vite/commit/9f6a43229af6b6f57a05c35216660a025a83a547) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 rolldown-vite 版本

## 3.0.0-alpha.0

### Major Changes

- [`fcf0e75`](https://github.com/weapp-vite/weapp-vite/commit/fcf0e75cb4ce73d4841676353a0b95d1d044db91) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - 将 init 入口拆分为项目配置、包初始化、配置文件生成、模板创建等独立模块，保持对外 API 不变
  - 新增通用的文件与路径工具、健壮的 npm 版本解析，以及非破坏式的 .gitignore 合并，提升项目初始化可靠性
  - 发布时自动将模板内的 `.gitignore` 重命名为 `gitignore`，并在项目生成后恢复为 `.gitignore`，确保忽略规则正确下发

### Patch Changes

- [`9f6a432`](https://github.com/weapp-vite/weapp-vite/commit/9f6a43229af6b6f57a05c35216660a025a83a547) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 rolldown-vite 版本

## 2.1.5

### Patch Changes

- [`576c8e1`](https://github.com/weapp-vite/weapp-vite/commit/576c8e1f5a143031ed3c321bf25a8e66a0d8c043) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 优化模板创建

- [`9f14216`](https://github.com/weapp-vite/weapp-vite/commit/9f142162dd7dc28a576e7f9617e4b57adfa59048) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade tsdown to 0.15.3

## 2.1.4

### Patch Changes

- [`9733680`](https://github.com/weapp-vite/weapp-vite/commit/9733680cbdcc2a54a9c89f5f50b2b0f951202745) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 2.1.3

### Patch Changes

- [`0e52d23`](https://github.com/weapp-vite/weapp-vite/commit/0e52d236e666753c76b8fb23cc65173b46d0cb8a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 tsdown 的版本

- [`4a816f4`](https://github.com/weapp-vite/weapp-vite/commit/4a816f4c42084ef301f4c5b64f20595d7be8f62f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 更新 rolldown-vite 版本到 `7.1.9`

## 2.1.2

### Patch Changes

- [`3f0b3a2`](https://github.com/weapp-vite/weapp-vite/commit/3f0b3a2fb8dfbb83cd83e3b005ab3e9ccd2d4480) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 避免使用 `latest` 来设置依赖版本, 鼓励进行版本更新

## 2.1.1

### Patch Changes

- [`d8523bb`](https://github.com/weapp-vite/weapp-vite/commit/d8523bbf20a22abe5399808060da8854d0cfe68e) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 默认提炼多次引入的 import 到 common.js 中

## 2.1.0

### Minor Changes

- [`ef98c7d`](https://github.com/weapp-vite/weapp-vite/commit/ef98c7d5f4e7e9836f4e4c21ae80fae4581deb7a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 使用 `rolldown` 的 `advancedChunks` 优化代码块的拆分

  feat: 取消 `chunk` `hash` 的生成，避免开发者工具频繁清除缓存

  [#142](https://github.com/weapp-vite/weapp-vite/issues/142)

## 2.0.10

### Patch Changes

- [`2144ba3`](https://github.com/weapp-vite/weapp-vite/commit/2144ba3b8ae4ffd753f4bef8dab1e15553ac01fb) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 更新模板

## 2.0.9

### Patch Changes

- [`66a2df2`](https://github.com/weapp-vite/weapp-vite/commit/66a2df2c484666f4d715b0d450a7e0925e10a273) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 tsdown 版本

- [`26e25bb`](https://github.com/weapp-vite/weapp-vite/commit/26e25bbcd71e834ad0d3791816cb90bd3deca122) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: bump version

- [`6f4096e`](https://github.com/weapp-vite/weapp-vite/commit/6f4096e2a9fa0d7b287b2d07b42b58999d7caa7f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: bump version

## 2.0.8

### Patch Changes

- [`c0137f1`](https://github.com/weapp-vite/weapp-vite/commit/c0137f1009b96a6d68555a54f5b64a843bfad431) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: use target: ['es2015']

- [`40aa53d`](https://github.com/weapp-vite/weapp-vite/commit/40aa53dada7bf03096f6382964bf66253e2bd839) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: support es6 new class 语法

  https://github.com/weapp-vite/weapp-vite/issues/147

## 2.0.7

### Patch Changes

- [`966853e`](https://github.com/weapp-vite/weapp-vite/commit/966853e32e2805bc5a4b372f72586c60955926f1) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 2.0.6

### Patch Changes

- [`b8e58c3`](https://github.com/weapp-vite/weapp-vite/commit/b8e58c38b0c95a2440601879e98511e08d90d821) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 rolldown 和 rolldown vite 版本

## 2.0.5

### Patch Changes

- [`f1fd325`](https://github.com/weapp-vite/weapp-vite/commit/f1fd3250cfec6a508535618169de0f136ec5cbc2) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade 升级依赖版本

- [`975ef00`](https://github.com/weapp-vite/weapp-vite/commit/975ef001277f596012ee115eb154140e41c19e72) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: bump version

## 2.0.4

### Patch Changes

- [`3af287e`](https://github.com/weapp-vite/weapp-vite/commit/3af287ea2d35b309d9891d02242d551ef14f3a2e) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: bump `rolldown-vite` and `rolldown` version

## 2.0.3

### Patch Changes

- [`4ef7c3d`](https://github.com/weapp-vite/weapp-vite/commit/4ef7c3d3480fce8f8c241f3e1e1238628313350d) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: [#136](https://github.com/weapp-vite/weapp-vite/issues/136)

## 2.0.2

### Patch Changes

- [`a59845c`](https://github.com/weapp-vite/weapp-vite/commit/a59845c085a2484a29dd19d51ebef5f48e875dc1) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade rolldown-vite

- [`0ae2a53`](https://github.com/weapp-vite/weapp-vite/commit/0ae2a53198b8d3ab3e8a9ac18ee125e2017a8f51) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: change website url

## 2.0.1

### Patch Changes

- Updated dependencies [[`7a8a130`](https://github.com/weapp-vite/weapp-vite/commit/7a8a130aff74304bb59ca9d2783783c81850c3f0)]:
  - @weapp-core/shared@2.0.1

## 2.0.0

### Major Changes

- [`0fefeca`](https://github.com/weapp-vite/weapp-vite/commit/0fefeca50752fc33ecb5403072f0f863b04686ef) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat!: 使用 tsdown 全面替换 tsup , 去除 esbuild 依赖
  feat!: use `rolldown-require` instead of `bundle-require` and remove `esbuild`

- [`32738e9`](https://github.com/weapp-vite/weapp-vite/commit/32738e92712d650cdc7651c63114464170d159a4) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 更多详情见:

  https://vite.icebreaker.top/migration/v5.htm

### Patch Changes

- Updated dependencies [[`32738e9`](https://github.com/weapp-vite/weapp-vite/commit/32738e92712d650cdc7651c63114464170d159a4)]:
  - @weapp-core/logger@2.0.0
  - @weapp-core/shared@2.0.0

## 2.0.0-beta.0

### Major Changes

- [`0fefeca`](https://github.com/weapp-vite/weapp-vite/commit/0fefeca50752fc33ecb5403072f0f863b04686ef) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat!: 使用 tsdown 全面替换 tsup , 去除 esbuild 依赖
  feat!: use `rolldown-require` instead of `bundle-require` and remove `esbuild`

## 1.2.2

### Patch Changes

- [`8c61a0f`](https://github.com/weapp-vite/weapp-vite/commit/8c61a0fb12298b90cf0f0aeebcea8d42aa2afd3a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 添加 tslib 作为构建依赖

## 1.2.1

### Patch Changes

- [`a9c1c9e`](https://github.com/weapp-vite/weapp-vite/commit/a9c1c9e3ff5e7312effa85c3be92eb6647b07fcc) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 增加插件开发的 `export` 作为打包入口，同时编译到产物中去

## 1.2.0

### Minor Changes

- [`1401bed`](https://github.com/weapp-vite/weapp-vite/commit/1401bedf00f722b1f03917b02481aafa456ac129) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: support plugin development

## 1.1.18

### Patch Changes

- [`e8d9e03`](https://github.com/weapp-vite/weapp-vite/commit/e8d9e03b9508eabde1a43245eecd3408a757413b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`e8d9e03`](https://github.com/weapp-vite/weapp-vite/commit/e8d9e03b9508eabde1a43245eecd3408a757413b)]:
  - @weapp-core/logger@1.0.4
  - @weapp-core/shared@1.0.8

## 1.1.17

### Patch Changes

- [`ce411f5`](https://github.com/weapp-vite/weapp-vite/commit/ce411f5ca65be7a2457223dc493e7d3f30b771f0) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 更换 json $schema 引用地址以应对 dns 劫持污染

- [`3983ea5`](https://github.com/weapp-vite/weapp-vite/commit/3983ea552aa9b36ff4aea642aebc3f567d6e0a3d) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 去除 subpackage service 改为编译时插件递归处理

- Updated dependencies [[`bbd3334`](https://github.com/weapp-vite/weapp-vite/commit/bbd3334758fa3b6fb8fc0571957d2a4a51ab1a1c)]:
  - @weapp-core/shared@1.0.7

## 1.1.16

### Patch Changes

- [`4907eae`](https://github.com/weapp-vite/weapp-vite/commit/4907eae52e0c5f3399c1468a0688f69a99f61f95) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: miss .gitignore file

- [`c70141a`](https://github.com/weapp-vite/weapp-vite/commit/c70141ab30b16b74e34055f2d6aff9f61332da81) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`c70141a`](https://github.com/weapp-vite/weapp-vite/commit/c70141ab30b16b74e34055f2d6aff9f61332da81)]:
  - @weapp-core/logger@1.0.3
  - @weapp-core/shared@1.0.6

## 1.1.15

### Patch Changes

- [`cac6148`](https://github.com/weapp-vite/weapp-vite/commit/cac6148819fb25f541e6d6b5edebcf33b935ae04) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: normalize templates

- [`61c7e8b`](https://github.com/weapp-vite/weapp-vite/commit/61c7e8b1d7ea3c4f6c0fcb4dc73b016693d45204) Thanks [@sonofmagic](https://github.com/sonofmagic)! - ---
  - chore: 更改模板组件行为
  - chore: weapp-vite 依赖项 resolve

- [`ed79551`](https://github.com/weapp-vite/weapp-vite/commit/ed795512f7ddc9fbe0b2be5f67172257439ad7c2) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade template

- [`4f72349`](https://github.com/weapp-vite/weapp-vite/commit/4f723498d7a4db28eba5a50f6fccda6b78a10020) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: add TemplateName refs

- [`8682d07`](https://github.com/weapp-vite/weapp-vite/commit/8682d07cb9e9fb34acf1ce8c38756d38c005cd35) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: build error and add semver/functions/parse as dep

- [`f15117e`](https://github.com/weapp-vite/weapp-vite/commit/f15117e42630f2b2452fb55db2daa580b98ac0b4) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade weapp-vite-template

- Updated dependencies [[`8682d07`](https://github.com/weapp-vite/weapp-vite/commit/8682d07cb9e9fb34acf1ce8c38756d38c005cd35)]:
  - @weapp-core/shared@1.0.5

## 1.1.15-alpha.5

### Patch Changes

- [`ed79551`](https://github.com/weapp-vite/weapp-vite/commit/ed795512f7ddc9fbe0b2be5f67172257439ad7c2) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade template

## 1.1.15-alpha.4

### Patch Changes

- [`f15117e`](https://github.com/weapp-vite/weapp-vite/commit/f15117e42630f2b2452fb55db2daa580b98ac0b4) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade weapp-vite-template

## 1.1.15-alpha.3

### Patch Changes

- [`cac6148`](https://github.com/weapp-vite/weapp-vite/commit/cac6148819fb25f541e6d6b5edebcf33b935ae04) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: normalize templates

## 1.1.15-alpha.2

### Patch Changes

- [`8682d07`](https://github.com/weapp-vite/weapp-vite/commit/8682d07cb9e9fb34acf1ce8c38756d38c005cd35) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: build error and add semver/functions/parse as dep

- Updated dependencies [[`8682d07`](https://github.com/weapp-vite/weapp-vite/commit/8682d07cb9e9fb34acf1ce8c38756d38c005cd35)]:
  - @weapp-core/shared@1.0.5-alpha.0

## 1.1.15-alpha.1

### Patch Changes

- [`4f72349`](https://github.com/weapp-vite/weapp-vite/commit/4f723498d7a4db28eba5a50f6fccda6b78a10020) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: add TemplateName refs

## 1.1.15-alpha.0

### Patch Changes

- [`61c7e8b`](https://github.com/weapp-vite/weapp-vite/commit/61c7e8b1d7ea3c4f6c0fcb4dc73b016693d45204) Thanks [@sonofmagic](https://github.com/sonofmagic)! - ---
  - chore: 更改模板组件行为
  - chore: weapp-vite 依赖项 resolve

## 1.1.14

### Patch Changes

- [`8ddfc97`](https://github.com/weapp-vite/weapp-vite/commit/8ddfc97a5706a25fa146b10fa43b7dc626a9f893) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 1.1.13

### Patch Changes

- Updated dependencies [[`0af89c5`](https://github.com/weapp-vite/weapp-vite/commit/0af89c5837046dfca548d62427adba9b4afc2d6a)]:
  - @weapp-core/logger@1.0.2

## 1.1.12

### Patch Changes

- [`c2f29a1`](https://github.com/weapp-vite/weapp-vite/commit/c2f29a15a651389175fbe7cb5c6e1644bcaafd1c) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: add dev:open script

- [`ea7be91`](https://github.com/weapp-vite/weapp-vite/commit/ea7be91e0d230b499691ae75239659c4586346af) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: support multi-platform software

## 1.1.11

### Patch Changes

- [`5735e56`](https://github.com/weapp-vite/weapp-vite/commit/5735e5651a793611489afbbd7982241b6792f8fc) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: update init template

## 1.1.10

### Patch Changes

- [`9daa971`](https://github.com/weapp-vite/weapp-vite/commit/9daa971ffb8a2ffec3e26e7e186b8d75708a8cf0) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 支持内联 wxs 引入其他的 wxs 文件

## 1.1.9

### Patch Changes

- [`53d5903`](https://github.com/weapp-vite/weapp-vite/commit/53d5903cf60e7b2316bdbc6d9dcadac16a7517bf) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade weapp-vite-tailwindcss-template

## 1.1.8

### Patch Changes

- [`7f9c36a`](https://github.com/weapp-vite/weapp-vite/commit/7f9c36a30e41b4a2b95e61080f645b7c169fe847) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade weapp-vite-tailwindcss-template

- Updated dependencies [[`c11d076`](https://github.com/weapp-vite/weapp-vite/commit/c11d07684c4592700a1141f2dc83dc3ce08c6676)]:
  - @weapp-core/shared@1.0.4

## 1.1.7

### Patch Changes

- [`0e2c9cb`](https://github.com/weapp-vite/weapp-vite/commit/0e2c9cb24c5a7dd803aaded340820ed4a1522f52) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持 Skyline 全局工具栏 appBar

## 1.1.6

### Patch Changes

- [`d818041`](https://github.com/weapp-vite/weapp-vite/commit/d8180411fb76102c6a0f792e90246715880993ad) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: dts 中对于 vite/client 的继承和智能提示

## 1.1.5

### Patch Changes

- [`1825f02`](https://github.com/weapp-vite/weapp-vite/commit/1825f024172dfeb357536c0aaeba6c4d53d97196) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 更新 weapp-vite-tailwindcss-template 模板

## 1.1.4

### Patch Changes

- [`583b913`](https://github.com/weapp-vite/weapp-vite/commit/583b913212c5e5b080975a5e946f8d0ea6828aa7) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: weapp-vite-tailwindcss-template tsconfig.json paths option

## 1.1.3

### Patch Changes

- [`228e4d2`](https://github.com/weapp-vite/weapp-vite/commit/228e4d2a9f780c018b13e91e15d1057d3c1360e0) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: make weapp-tailwindcss to lts

## 1.1.2

### Patch Changes

- [`401fc58`](https://github.com/weapp-vite/weapp-vite/commit/401fc584fad1c884ac8f276f3dc4daccde9fe659) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: createProject workspace:\* error

## 1.1.1

### Patch Changes

- [`bc9f19d`](https://github.com/weapp-vite/weapp-vite/commit/bc9f19dcf73e38b6b8a835a3e4660980eb1d9a7b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 改进整个 `weapp-vite-tailwindcss-template` 模板

## 1.1.0

### Minor Changes

- [`e428516`](https://github.com/weapp-vite/weapp-vite/commit/e428516fd993bd9b4081c12773d614bf30fd48cd) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 添加内置的模板支持

## 1.0.9

### Patch Changes

- [`1d84143`](https://github.com/weapp-vite/weapp-vite/commit/1d8414388e2fb18d4ccec0d743de787d934e772e) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: async all function
  feat: 自动创建 project.config.json

## 1.0.8

### Patch Changes

- Updated dependencies [[`1596334`](https://github.com/weapp-vite/weapp-vite/commit/159633422903bf3b5a5a3015bc0c495ec672c308)]:
  - @weapp-core/shared@1.0.3

## 1.0.7

### Patch Changes

- Updated dependencies [[`e15adce`](https://github.com/weapp-vite/weapp-vite/commit/e15adce483e9b47ef836680df49321db5431ac31)]:
  - @weapp-core/shared@1.0.2

## 1.0.6

### Patch Changes

- [`c6d3b43`](https://github.com/weapp-vite/weapp-vite/commit/c6d3b43aba1d465f8353cde04d21113e0766ed8d) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix:

## 1.0.5

### Patch Changes

- [`374bd9d`](https://github.com/weapp-vite/weapp-vite/commit/374bd9d22ad9df1aac65338f741b6fcc70bd342c) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 添加 typescript 作为初始化 dev 依赖

## 1.0.4

### Patch Changes

- [`c0146d3`](https://github.com/weapp-vite/weapp-vite/commit/c0146d31304f35db5b3a03aa9f9497ed46688730) Thanks [@sonofmagic](https://github.com/sonofmagic)! - improve init script and allow init project by `npx weapp init`

## 1.0.3

### Patch Changes

- [`b40bc77`](https://github.com/sonofmagic/weapp-tailwindcss/commit/b40bc7716861343bc63ca3a9fa8ade9388614ae8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - Date: 2024-09-01
  - 重构 `vite` 上下文的实现
  - 优化自定义的路径的显示效果

## 1.0.2

### Patch Changes

- fbb1ed7: 修复 `@weapp-core/init` 和 `weapp-vite` 的一些问题

## 1.0.1

### Patch Changes

- f7a2d5d: fix: watcher do not close error
- Updated dependencies [f7a2d5d]
  - @weapp-core/logger@1.0.1
  - @weapp-core/shared@1.0.1

## 1.0.0

### Major Changes

- 36f5a7c: release major version

### Patch Changes

- 80ce9ca: `@weapp-ide-cli` cjs -> esm ( `type: module` ) (BREAKING CHANGE!)

  `weapp-vite` use `@weapp-ide-cli`

  `vite.config.ts` support

  enhance `@weapp-core/init`

- 0fc5083: release alpha
- f22c535: chore: compact for `weapp-vite`
- 2b7be6d: feat: add serve watch files
- Updated dependencies [80ce9ca]
- Updated dependencies [0fc5083]
- Updated dependencies [f22c535]
- Updated dependencies [36f5a7c]
- Updated dependencies [2b7be6d]
  - @weapp-core/shared@1.0.0

## 1.0.0-alpha.4

### Major Changes

- 36f5a7c: release major version

### Patch Changes

- Updated dependencies [36f5a7c]
  - @weapp-core/shared@1.0.0-alpha.4

## 0.0.2-alpha.3

### Patch Changes

- 792f50c: chore: compact for `weapp-vite`
- Updated dependencies [792f50c]
  - @weapp-core/shared@0.0.2-alpha.3

## 0.0.2-alpha.2

### Patch Changes

- ffa21da: `@weapp-ide-cli` cjs -> esm ( `type: module` ) (BREAKING CHANGE!)

  `weapp-vite` use `@weapp-ide-cli`

  `vite.config.ts` support

  enhance `@weapp-core/init`

- Updated dependencies [ffa21da]
  - @weapp-core/shared@0.0.2-alpha.2

## 0.0.2-alpha.1

### Patch Changes

- a4adb3f: feat: add serve watch files
- Updated dependencies [a4adb3f]
  - @weapp-core/shared@0.0.2-alpha.1

## 0.0.2-alpha.0

### Patch Changes

- f28a193: release alpha
- Updated dependencies [f28a193]
  - @weapp-core/shared@0.0.2-alpha.0

## 0.0.1

### Patch Changes

- f01681a: release version
- Updated dependencies [f01681a]
  - @weapp-core/shared@0.0.1
