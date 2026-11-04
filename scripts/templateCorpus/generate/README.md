# 冻结框架模板生成

生成器只编译选定仓库的受控源码目录。工程配置、安装命令和启动器由本目录维护，不运行上游工程的 npm scripts、Vite/Webpack/Babel 配置或安装脚本。输入不得包含符号链接、`node_modules`、`.git` 或自动加载的工具配置。

`frameworks.json` 登记计划内七个固定版本及额外冻结的 Ant Design Mini `3.4.3` 受控上游管线，并保存官方目标证据。`candidate` 表示需要实际构建；它不表示构建通过。`unsupported` 仅用于上游明确拒绝的目标。实际编译状态按 development、production 分别记录为 pending、built、failed 或 unsupported。未收录的第三方目标插件不能被默认为官方支持。

查看矩阵：

```sh
node --import tsx scripts/templateCorpus/generate/index.ts --matrix
```

冻结上游源码时，先准备包含 `source.repository`、完整 `source.commit`、`source.license`、`prefix` 和可选 `exclude` glob 的配方，然后运行：

```sh
node --import tsx scripts/templateCorpus/generate/index.ts \
  --freeze-input input-recipe.json \
  --cache-dir .tmp/current-run/template-corpus/collector-cache \
  --output-dir .tmp/current-run/template-corpus/inputs
```

`prefix` 可为明确的空字符串（仓库根），也可为 `src` 等目录。完整 Git 树与每份原字节均校验 Git blob SHA；配置排除、用户排除、prefix 外文件和符号链接逐项记入 projection。源码、二进制静态资源、完整许可证、NOTICE、逐文件身份及重建配置分别保留。续行发现已经冻结的字节改变会失败，不静默覆盖。工具不运行下载的配置或脚本。

准备独立工程（不安装、不编译）：

```sh
node --import tsx scripts/templateCorpus/generate/index.ts \
  --framework uni-vue3 \
  --version 3.0.0-5030420261029002 \
  --target mp-weixin \
  --workspace .tmp/current-run/template-corpus/generated \
  --input .tmp/current-run/template-corpus/controlled/uni-src \
  --identity .tmp/current-run/template-corpus/controlled/uni-identity.json
```

身份文件必须包含真实公开仓库、40 位 commit 及归档已登记的许可证 ID：

```json
{
  "repository": "owner/project",
  "commit": "0123456789012345678901234567890123456789",
  "licenseId": "confirmed-source-license"
}
```

用同一命令增加 `--execute` 执行固定官方工具链。默认顺序构建 development 和 production；可用 `--mode development` 单独运行一格。失败后需显式 `--retry`，原始报告和历次日志均保留。成功格续行前验证源码、配置、锁文件、日志及产物哈希，发现替换立即拒绝复用。

输入源码依赖外部运行库时，使用 `--dependencies pinned-dependencies.json` 显式传入包名到准确版本的 JSON 对象。该对象进入工程身份、配置及构建证据，不接受范围、Git/本地依赖或替换受控编译器。不同目标工程保留独立锁文件，仅复用 pnpm 自身内容寻址 store，不共享可变 `node_modules` 链接。例如固定 hello-uniapp 源码在当前 Vue3 工具链下使用 `{"pinia":"2.1.7","vuex":"4.1.0"}`，Vue2 使用 `{"vuex":"3.6.2"}`；不能照搬需要 Vue 3.5 的新版 Pinia 到本矩阵的 Vue 3.4.21。

输入根目录按各框架的源码契约准备：

| 框架 | 输入源码根 |
| --- | --- |
| uni-app | `App.vue`、`main.js`/`main.ts`、`pages.json`、`manifest.json`、页面及组件 |
| MPX | `app.mpx` 及其引用的页面、组件与资源；输入方言固定为 wx |
| Taro | `app` 入口、页面、组件和应用声明；框架固定为 React |

源码来自冻结上游工程时，应在外部的受控准备步骤中明确记录选取、配置约束和完整源文件哈希。禁止复制微信产物后更改扩展名，禁止按目标批量替换指令生成配额。大型真实组件集合应作为源码交给对应官方编译器生成。

uni Vue3 启动器先设置 `NODE_ENV`，再调用官方 `initEnv('dev'|'build')` 及有限 `build()`；`uni build --mode development` 会被官方 CLI 强制切回 production，因此不能用该命令声称生成 development 产物。启动器不启用 watch。MPX 使用官方 Webpack plugin 并关闭 compiler；Taro 使用固定 CLI 的有限 build。

development 仍使用真实的 `mode` 与 `NODE_ENV=development`。MPX 显式关闭 Webpack 默认 eval devtool；Taro 2 QuickApp 通过官方 `mini.webpackChain` 关闭 devtool 与 pathinfo，并使用 hashed module ID，避免 loader query 中的本机绝对路径进入证据。MPX 两个固定版本仍会在 development 原生注入绝对 `currentResource`，未提供独立关闭选项；可分发验收应使用不含用户身份的隔离执行根，保留该字段的真实开发语义。构建后不改写产物。配置变化进入工程身份并创建新的冻结目录，旧报告、哈希与脱敏历史另存保留。

固定 uni 版本的静态资源复制插件仍会在 development 创建持久 `FileWatcher`，即使 Vite 的 build.watch 未开启。启动器仅在隔离子进程登记官方 `FileWatcher.prototype.watch` 本次返回成功的实例，等待官方 build 完成后关闭这些实例并恢复 prototype。已有外部实例不会关闭；编译及清理失败会一起保留。成功日志包含 mode 和已关闭实例数量，不通过 `process.exit` 或改成 production 掩盖未终结资源。

所有直接工具依赖固定版本；首次安装的完整传递依赖与 integrity 固定在生成工程的 `pnpm-lock.yaml`。安装使用官方 npm registry 和 `--ignore-scripts`。升级依赖需生成新的配置身份及证据，不能改写历史产物。

每个工程输出：

- `documents.jsonl`：实际 emitted 模板原文及完整 generated 来源；不包含脚本和样式文件。
- `generations.json`：development/production 状态与证据索引。
- `evidence/<mode>.json`：输入、配置、锁文件、命令、Node/pnpm 版本、全部构建输出和日志的 SHA-256。
- `evidence/attempt-*/`：各轮原始编译输出（机器目录已脱敏）。失败的报告另存 history。
- `src/`、`out/<mode>/`：原始受控输入与官方编译器实际产物。

将 documents 和 generations 并入归档时，还须保留对应的冻结 repository/license、输入源码、锁文件、配置、日志和全量产物。只复制 JSON 中的哈希而未保存对应字节不构成可复现的交付。

uni quickapp-webview 的真实输出是 `.qxml`（`qjs`），Harmony 小程序为 `.hxml`（`hjs`）；这些目标按各自身份登记。`.ux` 等容器使用独立的模板区间抽取，脚本、样式和 ArkTS 从不作为模板送入 parser。模板解析通过不扩大 weapp-vite 的平台构建或 runtime 支持。

历史 Jest 输出可通过 `--extract-expected frozen-upstream.snap --source-path 原仓库相对路径 --identity identity.json --profile jd-xml --output-dir 输出目录` 静态提取。默认只接受孤立的 pretty-format 字符串，`--snapshot-format literal` 用于明确的原始模板字面量。Babel 仅解析源码，读取 `exports[...] = 字面量` 和 `toMatchInlineSnapshot(字面量)`，不执行任何上游代码或插值表达式。工具保留完整原始文件及所有拒绝记录；混合对象、动态表达式及非模板 snapshot 不会被当作模板。调用者须按冻结测试文件及 snapshot key 确认真实目标，通过重复的 `--snapshot-key` 精确选择；禁止把同一混合目标 snapshot 文件全部归给单个平台。输出的 `expected-source.json` 固定原文件、格式、选中 keys 与来源身份；语料维护入口使用 `--expected 输出目录` 重算并导入，不能仅复制提取后的模板丢弃原文件证据。
