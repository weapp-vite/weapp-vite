import type { MpPlatform } from '../types'
import type { DoctorFile, DoctorLayer, DoctorReport } from './types'
import tsParser from '@typescript-eslint/parser'
import { miniProgramRuntimePlugin, wevuCompatibilityPlugin } from '@weapp-vite/eslint'
import { Linter } from 'eslint'
import vueParser from 'vue-eslint-parser'
import { addDiagnostic } from './report'

export function checkDoctorScripts(report: DoctorReport, target: MpPlatform, files: readonly DoctorFile[], layer: 'source' | 'artifact') {
  const linter = new Linter()
  let incomplete = false
  const eligible = files.filter(file => layer === 'artifact'
    ? /\.js$/.test(file.path)
    : /\.(?:[cm]?[jt]sx?|vue)$/.test(file.path)
      && !/(?:^|\/)(?:scripts|generated|node_modules)\/|\.web\.|(?:^|\/)node\.|\.(?:test|spec)\.|\.d\.[cm]?ts$/.test(file.path))
  for (const file of eligible) {
    const messages = linter.verify(file.text ?? '', {
      files: ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue}'],
      languageOptions: {
        parser: file.path.endsWith('.vue') ? vueParser : tsParser,
        parserOptions: { parser: tsParser, ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
      },
      plugins: { 'mini-program': miniProgramRuntimePlugin, 'wevu': wevuCompatibilityPlugin },
      rules: {
        'no-eval': 'error',
        'no-new-func': 'error',
        ...(target === 'weapp'
          ? {
              'mini-program/no-unsupported-runtime-api': layer === 'artifact' ? 'error' : 'warn',
              'mini-program/no-implicit-runtime-polyfill': 'warn',
            } as const
          : {}),
        ...(layer === 'source'
          ? {
              'wevu/no-unsupported-api': 'warn',
              'wevu/no-risky-api': 'warn',
              'wevu/no-unsupported-template-feature': 'warn',
            } as const
          : {}),
      },
    }, { filename: file.path })
    for (const message of messages) {
      if (message.fatal) {
        incomplete = true
      }
      addDiagnostic(report, {
        ruleId: `doctor/${layer}/${message.ruleId ?? 'parse'}`,
        layer,
        target,
        severity: message.severity === 2 ? 'error' : 'warning',
        message: message.message,
        location: { file: file.path, line: message.line, column: message.column },
        evidence: { expected: '可解析且符合所选执行域的静态契约', actual: message.message },
        responsibility: { owner: 'unknown', confidence: layer === 'source' ? 'suspected' : 'confirmed' },
        suggestion: layer === 'source' ? '核对编译转换与兼容层，再检查最终产物；源码风险不等同于宿主失败。' : '定位对应源码及构建插件，保留最小复现并在目标宿主验证。',
      })
    }
  }
  report.coverage.push({
    target,
    layer,
    check: 'script-syntax-and-static-risks',
    status: incomplete ? 'incomplete' : 'complete',
    reason: `检查 ${eligible.length} 个脚本；不推断动态类型或将静态扫描等同于完整运行正确性。`,
  })
  if (target !== 'weapp') {
    report.coverage.push({ target, layer, check: 'host-api-baseline', status: 'incomplete', reason: '所选平台尚无可复用的完整 API 基线；未套用微信规则。' })
  }
}

export function incompleteCoverage(report: DoctorReport, target: string, layer: DoctorLayer, check: string, reason: string) {
  report.coverage.push({ target, layer, check, status: 'incomplete', reason })
}
