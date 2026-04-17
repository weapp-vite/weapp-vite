import process from 'node:process'
import { WEAPI_MINIPROGRAM_METHODS, WEAPI_MY_METHODS, WEAPI_TT_METHODS } from '../src/core/apiCatalog.ts'
import { generateMethodCompatibilityMatrix } from '../src/core/methodMapping.ts'

const MIN_FULLY_ALIGNED_APIS = 117
const MIN_INTERSECTION_ALIGNED_APIS = 112
const MIN_INTERSECTION_ALIGNMENT_COVERAGE = 100

function formatCoverageRate(supportedApis, totalApis) {
  if (totalApis <= 0) {
    return '0.00%'
  }
  return `${((supportedApis / totalApis) * 100).toFixed(2)}%`
}

function run() {
  const matrix = generateMethodCompatibilityMatrix()
  const wxMethods = new Set(WEAPI_MINIPROGRAM_METHODS)
  const myMethods = new Set(WEAPI_MY_METHODS)
  const ttMethods = new Set(WEAPI_TT_METHODS)

  const fullyAlignedApis = matrix.filter(item => item.alipaySupported && item.douyinSupported).length

  const intersectionMethods = [...wxMethods].filter(method => myMethods.has(method) && ttMethods.has(method))
  const intersectionMethodSet = new Set(intersectionMethods)
  const intersectionAlignedApis = matrix.filter(
    item => intersectionMethodSet.has(item.method) && item.alipaySupported && item.douyinSupported,
  ).length
  const intersectionAlignmentCoverage = Number.parseFloat(
    formatCoverageRate(intersectionAlignedApis, intersectionMethods.length),
  )

  const errors = []
  if (fullyAlignedApis < MIN_FULLY_ALIGNED_APIS) {
    errors.push(
      `三端可调用完全对齐方法数下降：actual=${fullyAlignedApis}, min=${MIN_FULLY_ALIGNED_APIS}`,
    )
  }
  if (intersectionAlignedApis < MIN_INTERSECTION_ALIGNED_APIS) {
    errors.push(
      `三端命名交集可调用完全对齐方法数下降：actual=${intersectionAlignedApis}, min=${MIN_INTERSECTION_ALIGNED_APIS}`,
    )
  }
  if (intersectionAlignmentCoverage < MIN_INTERSECTION_ALIGNMENT_COVERAGE) {
    errors.push(
      `三端命名交集可调用覆盖率下降：actual=${intersectionAlignmentCoverage.toFixed(2)}%, min=${MIN_INTERSECTION_ALIGNMENT_COVERAGE.toFixed(2)}%`,
    )
  }

  if (errors.length > 0) {
    console.error('[weapi-coverage-guard] check failed')
    for (const error of errors) {
      console.error(`- ${error}`)
    }
    process.exitCode = 1
    return
  }

  console.log('[weapi-coverage-guard] check passed')
  console.log(`- 三端可调用完全对齐方法数: ${fullyAlignedApis}`)
  console.log(`- 三端命名交集方法数: ${intersectionMethods.length}`)
  console.log(`- 三端命名交集可调用完全对齐方法数: ${intersectionAlignedApis}`)
  console.log(`- 三端命名交集可调用覆盖率: ${intersectionAlignmentCoverage.toFixed(2)}%`)
}

run()
