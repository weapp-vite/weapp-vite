import process from 'node:process'
import { generateMethodCompatibilityMatrix } from '../src/core/methodMapping.ts'

const STRICT_RENAMED_ALLOWLIST = {
  my: [
    'checkIsSoterEnrolledInDevice->checkIsIfaaEnrolledInDevice',
    'checkIsSupportSoterAuthentication->checkIsSupportIfaaAuthentication',
    'closeBLEConnection->disconnectBLEDevice',
    'createBLEConnection->connectBLEDevice',
    'createRewardedVideoAd->createRewardedAd',
    'getClipboardData->getClipboard',
    'getSystemInfoAsync->getSystemInfo',
    'hideHomeButton->hideBackHome',
    'offBLEConnectionStateChange->offBLEConnectionStateChanged',
    'onBLEConnectionStateChange->onBLEConnectionStateChanged',
    'setClipboardData->setClipboard',
    'showModal->confirm',
  ].sort(),
  tt: [
    'getSystemInfoAsync->getSystemInfo',
  ].sort(),
}

function collectRenamedMappings(matrix, platform) {
  return matrix
    .filter(item => platform === 'my' ? item.alipayTarget !== item.method : item.douyinTarget !== item.method)
    .map(item => platform === 'my'
      ? `${item.method}->${item.alipayTarget}`
      : `${item.method}->${item.douyinTarget}`)
    .sort()
}

function diffRenamedMappings(actual, expected) {
  const actualSet = new Set(actual)
  const expectedSet = new Set(expected)
  const missing = expected.filter(item => !actualSet.has(item))
  const unexpected = actual.filter(item => !expectedSet.has(item))
  return {
    missing,
    unexpected,
  }
}

function run() {
  const matrix = generateMethodCompatibilityMatrix()
  const errors = []

  const fallbackMappings = matrix.filter(
    item => item.alipaySupportLevel === 'fallback' || item.douyinSupportLevel === 'fallback',
  )
  if (fallbackMappings.length > 0) {
    errors.push(`检测到 fallback 映射（必须为 0）：${fallbackMappings.map(item => item.method).join(', ')}`)
  }

  for (const platform of ['my', 'tt']) {
    const actual = collectRenamedMappings(matrix, platform)
    const expected = STRICT_RENAMED_ALLOWLIST[platform]
    const { missing, unexpected } = diffRenamedMappings(actual, expected)
    if (missing.length > 0 || unexpected.length > 0) {
      errors.push([
        `${platform} 异名映射白名单不一致`,
        missing.length > 0 ? `missing: ${missing.join(', ')}` : '',
        unexpected.length > 0 ? `unexpected: ${unexpected.join(', ')}` : '',
      ].filter(Boolean).join(' | '))
    }
  }

  for (const item of matrix) {
    if (item.alipayTarget !== item.method) {
      if (item.alipaySupportLevel !== 'mapped' || !item.alipaySemanticallyAligned) {
        errors.push(`my.${item.method} 的异名映射不是 strict mapped：${item.alipayTarget}`)
      }
    }
    if (item.douyinTarget !== item.method) {
      if (item.douyinSupportLevel !== 'mapped' || !item.douyinSemanticallyAligned) {
        errors.push(`tt.${item.method} 的异名映射不是 strict mapped：${item.douyinTarget}`)
      }
    }
  }

  if (errors.length > 0) {
    console.error('[weapi-strict-alias-guard] check failed')
    for (const error of errors) {
      console.error(`- ${error}`)
    }
    process.exitCode = 1
    return
  }

  console.log('[weapi-strict-alias-guard] check passed')
  console.log(`- my 异名映射数量: ${STRICT_RENAMED_ALLOWLIST.my.length}`)
  console.log(`- tt 异名映射数量: ${STRICT_RENAMED_ALLOWLIST.tt.length}`)
  console.log('- fallback 映射数量: 0')
}

run()
