# weapp-tailwindcss 5.5.2 升级记录

2026-09-08 核实 npm latest 为 5.5.2，2026-09-09 再次复核未变。本次从 5.5.1 升级默认 catalog、固定版本回归 catalog、锁文件和脚手架生成的依赖映射。

## 上游变更与集成边界

依据 [5.5.2 官方 changelog](https://github.com/sonofmagic/weapp-tailwindcss/blob/be518d94790c29aad401220b5cdb2a5d23173d5f/packages/weapp-tailwindcss/CHANGELOG.md#552) 和两个 npm 发布包的公开类型、实现对比：

- `weapp-tailwindcss/core` 的编译器公开签名未变，现有 `createCompiler`、`generate`、snapshot 与失效生命周期继续适用。
- 底层生成器使用 CSS tokenizer 解析导入和 `source()`，修复转义路径、Windows 路径序列化、删除文件时的符号链接身份处理，并补充 qxml 扫描。
- `@weapp-tailwindcss/postcss` 升级到 3.3.3，`weapp-style-injector` 升级到 1.0.5。
- Node 要求保持 `^22.18.0 || >=24.11.0`，Tailwind CSS 继续使用 4.x。

转义路径的验证范围须区分：真实 Core 回归覆盖了 `source("./source\20 pages")` 扫描空格目录；升级审计中，`@import "./styles\20 with\20 spaces/tailwind.css"` 仍被 enhanced-resolve 按含转义的原字符串解析并失败。后者是当前 fixture 未使用的上游探索边界，未计入通过用例，也未由本次 adapter 迁移修复。不能据 tokenizer 变更宣称所有 CSS import 转义均已支持。

weapp-vite 使用自己的 Core adapter，继续由单个编译器拥有 Tailwind 生成，CSS 入口使用被项目实际导入的纯 CSS 文件，并从项目根目录解析为绝对路径。此次补丁升级不需要替换 API 或重复注册上游 Vite 插件。

前置插件生成的 CSS 通过 Core 的 `sourceOptions.cssSources` 传入，保留 `file`、`base` 与依赖身份。adapter 在用户 pre 插件之后捕获内存源码，再生成入口标记；同一入口不会同时从磁盘重新读取。外链 SFC 样式保持原请求身份，热更新继续通过对应源文件失效。#779 回归以 pre 注入的 `@apply p-[13px]` 编译结果和真实 IDE 的 13px padding、文本及颜色共同验收，单纯存在普通 CSS 规则或已展开 Tailwind 导入不能证明编译完成。

SFC 样式仍由 Vue loader 完成 scoped、预处理和依赖登记；引用同一 CSS 的不同 SFC 样式块分别保存转换源码，避免作用域互相覆盖。源文件失效后必须重新执行转换，生成阶段拒绝使用失效前的内存 CSS。转换后的样式来源会与 loader 元数据合并，继续由原 owner 交给 Vite/Rolldown 写出。

上游官方 Vite 插件的 CSS 合并和缓存修复不能直接代表自研 adapter 已获得相同修复。微信 IDE 连续更新中 WXSS 编译缺失的 [跟踪项 #977](https://github.com/weapp-vite/weapp-vite/issues/977) 仍以真实 IDE 的计算样式、DOM 和状态保留结果独立验收。

## 验证入口

现有 adapter、输出所有权和 HMR 单测验证调用契约，真实 Core 回归验证 CSS 路径和模板失效语义。下游覆盖使用：

`packages/weapp-vite/test-d/config-public-types/tailwind-public.test-d.ts` 直接引用 `weapp-vite/config`、`weapp-vite/types` 和上游 Core 发布类型，校验编译器回调、内存 CSS 来源选项及错误类型负例。该目录使用 NodeNext 消费真实发布声明，通过显式 `--files "**/*.test-d.ts"` 收集每个契约文件，避免 tsd 默认只执行 `index.test-d.ts` 而遗漏新增测试。最终通过状态以完整类型命令的结果为准。

```sh
pnpm --filter weapp-vite typecheck
pnpm --filter weapp-vite test:types
pnpm --filter weapp-vite build
pnpm vitest run -c e2e/vitest.e2e.ci.config.ts e2e/ci/template-tailwind-v4-source.build.test.ts e2e/ci/template-tailwind-hmr.test.ts e2e/ci/issue-814-tailwind-dynamic-class.e2e.test.ts
pnpm e2e:ide:full:exhaustive
```

所有 E2E 串行执行，最终通过状态读取对应提交的严格验收报告；此记录本身不代表全量测试已经通过。

## 历史示例的内置配置迁移

六个历史示例不再注册 `weapp-tailwindcss/vite`：`vite-native`、`vite-native-skyline`、`vite-native-ts-skyline`、`weapp-wechat-zhihu`、`multi-platform-wevu-tdesign-demo` 和 `wevu-vue-sfc-recording-demo`。旧插件会被 preflight 移除，但其选项不会转交给 Core；因此将 `rem2rpx`、真实 `cssEntries` 和 native 的根选择器设置移入 `weapp.tailwindcss`。native 原来的 `__TEST__` 分支仅跳过外置插件，不能迁移成关闭整个内置生成器。

前四个原生示例通过 App 脚本直接 import 纯 CSS 入口，多平台示例通过 App.vue 的 style src 导入；这些新入口只导入 Tailwind theme 与 utilities，继续不启用 preflight；通过 `@config` 保留内容扫描和多平台示例的 MDI 图标插件。v4 不执行旧 `corePlugins.container: false`，因此原本禁用 container 的三个示例使用 `@source not inline("container")` 排除该工具类，避免与知乎等应用的作者 `.container` 冲突。录屏示例继续使用已有 `src/app.css`。SCSS/WXSS 作者样式、Vant/TDesign 样式导入和多平台示例的 page 字体与背景均保留原入口所有权。

构建检查须对应真实页面已有类：native 的 `p-5`、Skyline 的 `text-[100px]`、TS Skyline 的 `text-[200rpx]`、多平台示例的 `p-[24rpx]`。知乎和录屏当前页面使用作者类，分别检查 `.container` 的布局与 `.page` 的 `36rpx` padding；不能把它们声称为已有 Tailwind utility 的运行时验收。最终还需在实际 IDE 验证相应 DOM 与样式，构建成功或保留 CSS 规则均不替代该验收。

迁移构建暴露两处静默丢失：原生 sidecar 中的 CSS `@import` 只经预处理器展开，不会使子入口进入 Core adapter 的模块 transform，因此现在由 App 脚本直接导入生成入口，原相邻 SCSS/WXSS 继续持有作者样式；完整 production 构建同时拒绝未消费的显式 `cssEntries`。筛选构建、开发增量和独立分包沿用本轮访问入口检查，完整主图不要求另一个独立分包拥有的入口出现在主包资产中。

另一处是 `compiler.generate().css` 会裁剪生成样式中的裸标签，不能作为含作者 `page`/`view` 规则的完整样式。adapter 改用公开 `rawCss`，在 CSS owner 合并后统一调用 `compiler.transformCss`；该公开接口仍执行平台样式转换、动态 color-mix 保护与 finalization，不复制上游私有实现。Core/adapter 回归按选择器与声明检查作者样式，并覆盖工具类、单位、根选择器、现代颜色和层/at-rule 清理。探索的 `calc(var(--opacity) * 100%)` 动态 alpha 在旧生成路径与新转换路径均退成基础色，这是尚未验收的上游边界；正式动态 alpha 回归使用上游支持的 `var(--opacity)` 形式且保留 rgba 透明度断言，未将该探索失败改成通过。

`tailwindcss.ts` 已超过 300 行，本轮评估后保留现有 compiler/output 生命周期闭包：入口访问集合、contextual slot、snapshot 与最终消费检查共享同一实例状态，单独抽出这次小段逻辑会增加状态传递和生命周期耦合；新增行为分别沉淀到 outputOwnership、transformedSource 和 Core compatibility 测试。最终转换对含生成入口的 owner 继续透传 `generator.styleOptions`，回归验证其根选择器与 rem2rpx 覆盖仍有效。

原生示例最后一处入口丢失来自 `@wv-keep-import` 启用条件 PostCSS 处理后，普通注释清理一并删除 Tailwind 待生成标记。该标记现在按内部 CSS owner 协议保留，继续由最终生成阶段消费；普通注释仍清理，已排除的平台分支中的标记仍随分支删除。真实 PostCSS 回归同时覆盖三者，避免给业务源码增加占位或绕过严格入口检查。

本轮迁移后的六应用构建与样式 AST 检查全部通过：从 app.wxss 和实际首页样式递归读取可达资源，按具体选择器、属性与值验证，避免仅搜索颜色误命中无关 utility。`p-5` 使用 `calc(var(--spacing) * 5)` 与 page 作用域的 `--spacing: 8rpx`，有效 padding 为 40rpx；不要求打包器必须折叠成单个字面量。新增 Core/owner 回归及既有 Tailwind 生命周期覆盖共 8 文件、52 测试通过，PostCSS 标记回归 7 测试通过，完整公开类型测试通过。这些记录仍是提交前的局部验证，不替代最终提交的全量验收。

人工示例 `vite-native` 的旧配置仍包含无源码的 `pages/features/build/index`，本轮首页构建样式验证不将该历史页面计为已验收。所有新入口、相邻作者样式及真实首页文件均已按实际产物检查。

相关下游回归 `skyline-hmr-fallback`、`template-tailwind-v4-source.build`、`template-tailwind-hmr`、`issue-814-tailwind-dynamic-class.e2e` 串行运行共 4 文件、9 测试通过，包含五套 Tailwind 模板的 HMR 与现有内存预算检查。
