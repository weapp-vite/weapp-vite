import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import prettier from 'prettier'
import { WEAPI_MY_METHODS, WEAPI_TT_METHODS } from '../src/core/apiCatalog.ts'
import { generateMethodCompatibilityMatrix } from '../src/core/methodMapping.ts'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(currentDir, '..')
const reportPath = path.join(rootDir, 'reports/plans/strict-alias-candidates.md')
const defaultThreshold = 0.75

function parseThreshold(argv) {
  const thresholdArg = argv.find(arg => arg.startsWith('--threshold='))
  if (!thresholdArg) {
    return defaultThreshold
  }
  const value = Number.parseFloat(thresholdArg.slice('--threshold='.length))
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`invalid threshold: ${thresholdArg}`)
  }
  return value
}

const CAMEL_CASE_BOUNDARY_RE = /([a-z])([A-Z])/g
const NON_ALPHANUMERIC_RE = /[^a-z0-9]+/

function splitMethodTokens(methodName) {
  return methodName
    .replace(CAMEL_CASE_BOUNDARY_RE, '$1 $2')
    .toLowerCase()
    .split(NON_ALPHANUMERIC_RE)
    .filter(Boolean)
}

function calculateSimilarity(left, right) {
  const leftTokens = new Set(splitMethodTokens(left))
  const rightTokens = new Set(splitMethodTokens(right))
  let overlap = 0
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1
    }
  }
  return overlap / Math.max(leftTokens.size, rightTokens.size)
}

function collectCandidates({
  methodPool,
  rows,
  threshold,
}) {
  const candidates = []

  for (const row of rows) {
    const bestMatch = methodPool
      .filter(name => name !== row.method)
      .map(name => ({
        name,
        score: calculateSimilarity(row.method, name),
      }))
      .sort((left, right) => right.score - left.score)[0]

    if (!bestMatch || bestMatch.score < threshold) {
      continue
    }

    candidates.push({
      method: row.method,
      candidate: bestMatch.name,
      score: bestMatch.score,
    })
  }

  return candidates.sort((left, right) => right.score - left.score || left.method.localeCompare(right.method))
}

function formatTableRows(rows) {
  if (rows.length === 0) {
    return '| - | - | - |\n'
  }
  return rows
    .map(item => `| \`${item.method}\` | \`${item.candidate}\` | ${item.score.toFixed(2)} |`)
    .join('\n')
}

async function writeReport(markdown) {
  const config = await prettier.resolveConfig(reportPath)
  const formatted = await prettier.format(`${markdown.trim()}\n`, {
    ...config,
    parser: 'markdown',
  })
  await fs.writeFile(reportPath, formatted)
}

async function run() {
  const threshold = parseThreshold(process.argv.slice(2))
  const matrix = generateMethodCompatibilityMatrix()
  const myRows = matrix.filter(item => !item.alipaySupported)
  const ttRows = matrix.filter(item => !item.douyinSupported)
  const myCandidates = collectCandidates({
    methodPool: WEAPI_MY_METHODS,
    rows: myRows,
    threshold,
  })
  const ttCandidates = collectCandidates({
    methodPool: WEAPI_TT_METHODS,
    rows: ttRows,
    threshold,
  })

  const markdown = `
# strict alias 候选复筛（自动生成）

- 阈值：\`${threshold.toFixed(2)}\`
- 输出规则：仅保留 \`unsupported\` 且“名称相似度 >= 阈值”的最佳候选。
- 注意：本清单仅用于复核线索，不代表可直接建立映射；仍需声明级与语义级证据。

## 支付宝候选（my）

共 ${myCandidates.length} 项。

| 微信 API | my 候选 API | 相似度 |
| --- | --- | ---: |
${formatTableRows(myCandidates)}

## 抖音候选（tt）

共 ${ttCandidates.length} 项。

| 微信 API | tt 候选 API | 相似度 |
| --- | --- | ---: |
${formatTableRows(ttCandidates)}
`

  await writeReport(markdown)
  console.log('[weapi-strict-alias-scan] report generated')
  console.log(`- path: ${reportPath}`)
  console.log(`- threshold: ${threshold.toFixed(2)}`)
  console.log(`- my candidates: ${myCandidates.length}`)
  console.log(`- tt candidates: ${ttCandidates.length}`)
}

run().catch((error) => {
  console.error('[weapi-strict-alias-scan] generate failed')
  console.error(error)
  process.exitCode = 1
})
