import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import prettier from 'prettier'
import {
  WEAPI_MY_METHODS,
  WEAPI_TT_METHODS,
  WEAPI_TYPE_SOURCES,
  WEAPI_WX_METHODS,
} from '../src/core/apiCatalog.ts'
import {
  generateApiSupportCoverageReport,
  generateMethodCompatibilityMatrix,
  WEAPI_METHOD_SUPPORT_MATRIX,
} from '../src/core/methodMapping.ts'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(currentDir, '..')
const reportDir = path.join(rootDir, 'reports/api-compat')

function escapePipe(value) {
  return String(value).replace(/\|/g, '\\|')
}

function formatBool(value) {
  return value ? '✅' : '❌'
}

function formatCoverageRate(supportedApis, totalApis) {
  if (totalApis <= 0) {
    return '0.00%'
  }
  return `${((supportedApis / totalApis) * 100).toFixed(2)}%`
}

function createIntersectionCoverageReport(matrix) {
  const myMethodSet = new Set(WEAPI_MY_METHODS)
  const ttMethodSet = new Set(WEAPI_TT_METHODS)
  const intersectionMethods = WEAPI_WX_METHODS.filter(method =>
    myMethodSet.has(method) && ttMethodSet.has(method),
  )
  const intersectionMethodSet = new Set(intersectionMethods)
  const intersectionRows = matrix.filter(item => intersectionMethodSet.has(item.method))
  const fullyAlignedApis = intersectionRows.filter(
    item => item.alipaySupported && item.douyinSupported,
  ).length
  const fullySemanticallyAlignedApis = intersectionRows.filter(
    item => item.alipaySemanticallyAligned && item.douyinSemanticallyAligned,
  ).length
  return {
    totalApis: intersectionMethods.length,
    fullyAlignedApis,
    fullyAlignedCoverage: formatCoverageRate(fullyAlignedApis, intersectionMethods.length),
    fullySemanticallyAlignedApis,
    fullySemanticallyAlignedCoverage: formatCoverageRate(
      fullySemanticallyAlignedApis,
      intersectionMethods.length,
    ),
  }
}

async function writeReportFile(fileName, content) {
  const filePath = path.join(reportDir, fileName)
  const config = await prettier.resolveConfig(filePath)
  const formatted = await prettier.format(`${content.trim()}\n`, {
    ...config,
    parser: 'markdown',
  })
  await fs.writeFile(filePath, formatted)
}

async function run() {
  await fs.mkdir(reportDir, { recursive: true })

  const report = generateApiSupportCoverageReport()
  const matrix = generateMethodCompatibilityMatrix()

  const alipaySupportedMethods = matrix.filter(item => item.alipaySupported)
  const alipayUnsupportedMethods = matrix.filter(item => !item.alipaySupported)
  const alipaySemanticAlignedMethods = matrix.filter(item => item.alipaySemanticallyAligned)
  const alipayFallbackMethods = matrix.filter(item => item.alipaySupportLevel === 'fallback')
  const douyinSupportedMethods = matrix.filter(item => item.douyinSupported)
  const douyinUnsupportedMethods = matrix.filter(item => !item.douyinSupported)
  const douyinSemanticAlignedMethods = matrix.filter(item => item.douyinSemanticallyAligned)
  const douyinFallbackMethods = matrix.filter(item => item.douyinSupportLevel === 'fallback')
  const fullyAlignedMethods = matrix.filter(item => item.alipaySupported && item.douyinSupported)
  const fullySemanticAlignedMethods = matrix.filter(item => item.alipaySemanticallyAligned && item.douyinSemanticallyAligned)
  const intersectionCoverage = createIntersectionCoverageReport(matrix)
  const wxMethodSet = new Set(WEAPI_WX_METHODS)
  const myOnlyMethods = WEAPI_MY_METHODS.filter(method => !wxMethodSet.has(method))
  const ttOnlyMethods = WEAPI_TT_METHODS.filter(method => !wxMethodSet.has(method))

  const coreMethodsNotInWx = WEAPI_METHOD_SUPPORT_MATRIX
    .map(item => item.method)
    .filter(method => !WEAPI_WX_METHODS.includes(method))

  const overview = `
# weapi 三端 API 兼容报告（总览）

- 类型来源：
  - 微信：\`${WEAPI_TYPE_SOURCES.wx.package}@${WEAPI_TYPE_SOURCES.wx.version}\`
  - 支付宝：\`${WEAPI_TYPE_SOURCES.my.package}@${WEAPI_TYPE_SOURCES.my.version}\`
  - 抖音：\`${WEAPI_TYPE_SOURCES.tt.package}@${WEAPI_TYPE_SOURCES.tt.version}\`

## 全量统计

| 指标 | 数值 |
| --- | ---: |
| 微信方法数（基准命名） | ${WEAPI_WX_METHODS.length} |
| 支付宝方法数 | ${WEAPI_MY_METHODS.length} |
| 抖音方法数 | ${WEAPI_TT_METHODS.length} |
| 支付宝独有方法数（不在 wx 命名） | ${myOnlyMethods.length} |
| 抖音独有方法数（不在 wx 命名） | ${ttOnlyMethods.length} |
| 支付宝可按微信命名调用的方法数 | ${alipaySupportedMethods.length} |
| 支付宝语义对齐方法数 | ${alipaySemanticAlignedMethods.length} |
| 支付宝 fallback 方法数 | ${alipayFallbackMethods.length} |
| 抖音可按微信命名调用的方法数 | ${douyinSupportedMethods.length} |
| 抖音语义对齐方法数 | ${douyinSemanticAlignedMethods.length} |
| 抖音 fallback 方法数 | ${douyinFallbackMethods.length} |
| 三端可调用完全对齐方法数 | ${fullyAlignedMethods.length} |
| 三端语义完全对齐方法数 | ${fullySemanticAlignedMethods.length} |
| 三端命名交集方法数（wx∩my∩tt） | ${intersectionCoverage.totalApis} |
| 三端命名交集可调用完全对齐方法数 | ${intersectionCoverage.fullyAlignedApis} |
| 三端命名交集语义完全对齐方法数 | ${intersectionCoverage.fullySemanticallyAlignedApis} |

## 覆盖率

| 平台 | 可调用 API 数 | 语义对齐 API 数 | fallback API 数 | API 总数 | 可调用覆盖率 | 语义对齐覆盖率 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${report.platforms.map(item => `| ${item.platform} (\`${item.alias}\`) | ${item.supportedApis} | ${item.semanticAlignedApis} | ${item.fallbackApis} | ${item.totalApis} | ${item.coverage} | ${item.semanticCoverage} |`).join('\n')}
| 三端可调用完全对齐 (wx/my/tt) | ${report.fullyAlignedApis} | - | - | ${report.totalApis} | ${report.fullyAlignedCoverage} | - |
| 三端语义完全对齐 (wx/my/tt) | - | ${report.fullySemanticallyAlignedApis} | - | ${report.totalApis} | - | ${report.fullySemanticallyAlignedCoverage} |
| 三端命名交集可调用完全对齐 (wx∩my∩tt) | ${intersectionCoverage.fullyAlignedApis} | - | - | ${intersectionCoverage.totalApis} | ${intersectionCoverage.fullyAlignedCoverage} | - |
| 三端命名交集语义完全对齐 (wx∩my∩tt) | - | ${intersectionCoverage.fullySemanticallyAlignedApis} | - | ${intersectionCoverage.totalApis} | - | ${intersectionCoverage.fullySemanticallyAlignedCoverage} |

## 核心差异映射（手工规则）

| API | 微信策略 | 支付宝策略 | 抖音策略 |
| --- | --- | --- | --- |
${WEAPI_METHOD_SUPPORT_MATRIX.map(item => `| \`${item.method}\` | ${escapePipe(item.wxStrategy)} | ${escapePipe(item.alipayStrategy)} | ${escapePipe(item.douyinStrategy)} |`).join('\n')}

## 已执行验证

- \`pnpm --filter @wevu/api build\`
- \`pnpm --filter @wevu/api test\`
- \`pnpm --filter @wevu/api test:types\`

## 目录

- [01-overview.md](./01-overview.md)
- [02-wx-method-list.md](./02-wx-method-list.md)
- [03-alipay-compat-matrix.md](./03-alipay-compat-matrix.md)
- [04-douyin-compat-matrix.md](./04-douyin-compat-matrix.md)
- [05-gap-notes.md](./05-gap-notes.md)
- [06-platform-only-methods.md](./06-platform-only-methods.md)
`

  const detailOverview = `
# 01 Overview

## 覆盖结论

- 微信基准命名方法总数：${WEAPI_WX_METHODS.length}
- 支付宝可调用兼容方法数：${alipaySupportedMethods.length}
- 支付宝语义对齐方法数：${alipaySemanticAlignedMethods.length}
- 支付宝 fallback 方法数：${alipayFallbackMethods.length}
- 抖音可调用兼容方法数：${douyinSupportedMethods.length}
- 抖音语义对齐方法数：${douyinSemanticAlignedMethods.length}
- 抖音 fallback 方法数：${douyinFallbackMethods.length}
- 三端可调用完全对齐方法数：${fullyAlignedMethods.length}
- 三端语义完全对齐方法数：${fullySemanticAlignedMethods.length}
- 三端命名交集方法数（wx∩my∩tt）：${intersectionCoverage.totalApis}
- 三端命名交集可调用完全对齐方法数：${intersectionCoverage.fullyAlignedApis}
- 三端命名交集可调用覆盖率：${intersectionCoverage.fullyAlignedCoverage}
- 三端命名交集语义完全对齐方法数：${intersectionCoverage.fullySemanticallyAlignedApis}
- 三端命名交集语义对齐覆盖率：${intersectionCoverage.fullySemanticallyAlignedCoverage}

## 不兼容规模

- 支付宝侧不兼容（按微信命名调用失败）方法：${alipayUnsupportedMethods.length}
- 抖音侧不兼容（按微信命名调用失败）方法：${douyinUnsupportedMethods.length}

## 不兼容示例（前 40 项）

### 支付宝不兼容示例

${alipayUnsupportedMethods.slice(0, 40).map(item => `- \`${item.method}\` -> 目标 \`${item.alipayTarget}\`（${item.alipaySupportLevel}）`).join('\n')}

### 抖音不兼容示例

${douyinUnsupportedMethods.slice(0, 40).map(item => `- \`${item.method}\` -> 目标 \`${item.douyinTarget}\`（${item.douyinSupportLevel}）`).join('\n')}
`

  const wxList = `
# 02 微信基准 API 全量清单

总计：${WEAPI_WX_METHODS.length}

${WEAPI_WX_METHODS.map(method => `- \`${method}\``).join('\n')}
`

  const alipayMatrix = `
# 03 支付宝兼容矩阵（按微信命名）

总计：${WEAPI_WX_METHODS.length}，支持：${alipaySupportedMethods.length}，不支持：${alipayUnsupportedMethods.length}

| 微信 API | 支付宝目标 API | 支持 | 支持级别 | 语义对齐 | 策略 |
| --- | --- | --- | --- | --- | --- |
${matrix.map(item => `| \`${item.method}\` | \`${item.alipayTarget}\` | ${formatBool(item.alipaySupported)} | \`${item.alipaySupportLevel}\` | ${formatBool(item.alipaySemanticallyAligned)} | ${escapePipe(item.alipayStrategy)} |`).join('\n')}
`

  const douyinMatrix = `
# 04 抖音兼容矩阵（按微信命名）

总计：${WEAPI_WX_METHODS.length}，支持：${douyinSupportedMethods.length}，不支持：${douyinUnsupportedMethods.length}

| 微信 API | 抖音目标 API | 支持 | 支持级别 | 语义对齐 | 策略 |
| --- | --- | --- | --- | --- | --- |
${matrix.map(item => `| \`${item.method}\` | \`${item.douyinTarget}\` | ${formatBool(item.douyinSupported)} | \`${item.douyinSupportLevel}\` | ${formatBool(item.douyinSemanticallyAligned)} | ${escapePipe(item.douyinStrategy)} |`).join('\n')}
`

  const gapNotes = `
# 05 兼容差异说明

## 说明范围

本文件记录“类型来源差异”与“命名对齐特殊点”，用于解释为何某些 API 在报告里显示不兼容。

## 关键差异

- 核心差异映射中存在不在微信方法清单的条目：
${coreMethodsNotInWx.length > 0 ? coreMethodsNotInWx.map(item => `  - \`${item}\``).join('\n') : '  - 无'}

- 报告中的 \`fallback\` 表示方法可调用但仅通过通用兜底目标适配，语义可能与微信不一致。

- 抖音 typings 中缺失 \`showActionSheet\`（但映射规则保留该能力），因此在类型清单统计中视为不支持。

- 报告中的“不支持”表示：按当前 typings 清单与映射规则，\`wpi.<wxMethod>\` 在该平台找不到可调用目标方法；运行时仍可能因宿主扩展而可用。

## 后续建议

1. 若需继续提升覆盖率，优先补充“同能力异名 API”映射（按业务优先级增量添加）。
2. 持续维护 \`strict-alias:check\` 与 \`coverage:check\` 门禁阈值；如发生有意变更，请同步更新阈值与报告。
`

  const platformOnlyMethods = `
# 06 平台独有方法清单

## 支付宝独有（相对微信命名）

总计：${myOnlyMethods.length}

${myOnlyMethods.map(method => `- \`${method}\``).join('\n')}

## 抖音独有（相对微信命名）

总计：${ttOnlyMethods.length}

${ttOnlyMethods.map(method => `- \`${method}\``).join('\n')}
`

  await writeReportFile('README.md', overview)
  await writeReportFile('01-overview.md', detailOverview)
  await writeReportFile('02-wx-method-list.md', wxList)
  await writeReportFile('03-alipay-compat-matrix.md', alipayMatrix)
  await writeReportFile('04-douyin-compat-matrix.md', douyinMatrix)
  await writeReportFile('05-gap-notes.md', gapNotes)
  await writeReportFile('06-platform-only-methods.md', platformOnlyMethods)
}

run().catch((error) => {
  console.error('[weapi-api-report] generate failed')
  console.error(error)
  process.exitCode = 1
})
