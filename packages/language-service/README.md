# @weapp-vite/language-service

CLI、编辑器、Oxlint 项目检查和 Oxfmt 适配层共用的小程序语言内核。模板分析和标签格式化使用 TypeScript；脚本分析复用仓库 AST 设施，脚本格式化通过调用方注入格式器。不会执行用户脚本或远程文档脚本。

## 平台与范围

| 平台 | 模板 | 原生样式 | 脚本模块 |
| --- | --- | --- | --- |
| 微信 | `.wxml` | `.wxss` | `.wxs` |
| 支付宝 | `.axml` | `.acss` | `.sjs` |
| 百度 | `.swan` | `.css` | `.sjs`、`.filter.js` |
| 抖音 | `.ttml` | `.ttss` | `.sjs` |
| 京东 | `.jxml` | `.jxss` | `.wxs` |
| 小红书 | `.xhsml` | `.css` | `.wxs` |
| QQ | `.qml` | `.qss` | `.wxs` |
| 快手 | `.ksml` | `.css` | `.ks` |
| 涂鸦 | `.tyml` | `.tyss` | `.sjs` |

实际后缀以 `languageProfiles` 为准。QQ、快手、涂鸦属于语言支持，不会扩展构建目标。脚本支持相应的 `.js`、`.ts` 编译源码后缀；百度 Filter 的编译源码是 `.filter.ts`。共享 `.sjs`、`.wxs` 和 `.css` 无法仅凭后缀确定平台，需要项目配置、文件覆盖规则或模板引用归属。

`getLanguageSupportMatrix()` 返回平台、后缀、组件快照状态及案例 ID；`languageSupportCases` 将 ID 映射到仓库内可执行测试文件与 suite。固定种子 `0x5eed2026` 在每个平台执行 128 组模板组合，断言受保护片段逐字保留、格式化幂等、无效输入拒绝修改。覆盖结论限定于登记的静态语言契约；宿主渲染和运行时结果由对应平台的集成测试证明。

## 使用

```ts
import {
  analyzeDocument,
  formatTemplateResult,
  getLanguageFileAssociations,
} from '@weapp-vite/language-service'

const result = analyzeDocument({
  fileName: 'pages/index.axml',
  source: '<view a:if="{{visible}}">  保留文本  </view>',
})

const formatted = formatTemplateResult('<view  class="page"/>', 'page.wxml')
// edits 使用原始文档的 UTF-16 [start, end) 范围，按源码顺序排列。
// 无效输入返回原文、空 edits 和结构化 diagnostics。
const associations = getLanguageFileAssociations()
```

`formatTemplate` 保留返回字符串、错误时抛出 `LanguageError` 的便捷接口。模板格式化只修改标签布局；文本、属性值、引号、属性顺序、重复属性、插值、注释、CDATA、声明与脚本正文均保留源码片段。未知组件和自定义属性不会因为缺少组件表条目而被拒绝。

原生 WXS、各平台 SJS、快手 KS 和百度 Filter 使用各自已核实的脚本约束；显式 `lang="ts"`、`lang="js"` 由编译源码路径处理。`getTemplateScriptInput` 统一内联脚本的虚拟文件名、方言、语言与来源类型，避免分析器、编辑器和格式器各自推断。

脚本分析的 `imports` 和 `externalUses` 提供静态 ESM default/named/namespace、CommonJS require 别名与解构、静态成员、转导出及原始 UTF-16 范围。分析尊重词法遮蔽，排除动态 require、动态属性、已重赋值绑定和纯类型引用。重命名元数据分别描述公共导入名与本地绑定，保留已有别名及 shorthand 的含义；编辑器直接消费这些事实，不再重新解析脚本。

`exportScope` / `targetScope` 区分 named、default 对象成员、CommonJS 和 default 本身，同名公开成员不会被合并。CommonJS 使用点通过 `targetPath` 保留完整静态属性路径。`getScriptTemplateExports` 将编译目标的公开路径关联到源码符号；尚未核实的宿主混合导出返回 `ambiguous`，保留源码并停止不确定的跨文件重命名。

## 组件数据

九个平台各自拥有离线组件快照，记录来源、快照日期和内容 SHA-256。微信、支付宝、抖音复用仓库已有平台专属目录；其原始抓取日期未知时明确保留 `upstreamRetrievedAt: null`。其他平台从各自官方文档同步，不回退为微信组件表。涂鸦使用官方 SchemaDoc JSON，京东使用当前公开文档客户端声明的接口；频道元数据只在同步进程内存中使用。

```sh
pnpm --filter @weapp-vite/language-service generate:schema
pnpm --filter @weapp-vite/language-service sync:schema swan
pnpm --filter @weapp-vite/language-service sync:schema jd
pnpm --filter @weapp-vite/language-service sync:schema ks --cache-dir <临时目录>
```

网络失败会中止本轮资产写入；限流时可以显式使用临时缓存断点续行。网络需要代理的 Node.js 24 环境可以启用 `NODE_USE_ENV_PROXY=1`。共享配置、编辑器关联和项目引用归属统一由公开的 profiles 与 `./project` API 提供。
