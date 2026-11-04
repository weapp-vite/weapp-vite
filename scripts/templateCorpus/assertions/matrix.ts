import type { ParseOptions } from '../../../packages/wxml/src/types'
import type { CorpusExpectation, CorpusProfile } from '../types'
import type { CorpusEntrySummary, ResolverFactory } from './corpus'
import type { AssertionMetrics, TemplateApi } from './types'
import type { XmlDifferentialSummary, XmlParserConstructor } from './xml'
import { assertTemplate } from './index'
import { CorpusAssertionError } from './types'
import { assertXmlDifferential, xmlDifferentialSummary } from './xml'

/** 受控工程产物独立验收，始终不进入真实来源数量与平台配额。 */
export interface MatrixTemplateCase {
  fixtureId: string
  generationId: string
  framework: string
  version: string
  target: string
  mode: string
  path: string
  platform: string
  profileId: string
  quotaEligible: false
  sha256: string
  source: string
  expectation?: CorpusExpectation
  diagnosticCodes?: string[]
  evidence?: string[]
}

export interface MatrixFailure extends MatrixTemplateCase {
  entry: 'default' | 'resolver' | 'differential'
  stage: string
  message: string
}

interface MatrixCounts {
  templates: number
  passed: number
  failed: number
  valid: number
  invalid: number
  pending: number
  observedFeatures: Record<string, number>
}

export interface MatrixCaseReport {
  quotaEligible: false
  templates: number
  uniqueContents: number
  accepted: boolean
  valid: number
  invalid: number
  pending: number
  entries: { default: CorpusEntrySummary, resolver: CorpusEntrySummary }
  differential: XmlDifferentialSummary
  platforms: Record<string, MatrixCounts>
  cells: Record<string, MatrixCounts & { framework: string, version: string, target: string, mode: string }>
  observedFeatures: Record<string, number>
  failures: MatrixFailure[]
}

function entrySummary(): CorpusEntrySummary {
  return { passed: 0, failed: 0, tokens: 0, nodes: 0, elements: 0, attributes: 0, edits: 0 }
}

function counts(): MatrixCounts {
  return { templates: 0, passed: 0, failed: 0, valid: 0, invalid: 0, pending: 0, observedFeatures: {} }
}

function addMetrics(summary: CorpusEntrySummary, metrics: AssertionMetrics) {
  summary.passed++
  for (const key of ['tokens', 'nodes', 'elements', 'attributes', 'edits'] as const) {
    summary[key] += metrics[key]
  }
}

/** 仅记录实际字节中的特征，不把工程声明或目标名字算作场景覆盖。 */
function observedFeatures(template: MatrixTemplateCase): string[] {
  const { source, path } = template
  const features: Array<[string, boolean]> = [
    ['page-output', /(?:^|\/)pages\//.test(path)],
    ['component-output', /(?:^|\/)components\//.test(path)],
    ['subpackage-output', /(?:^|\/)(?:subpackage|pkg)[^/]*\//i.test(path)],
    ['slot', /<slot[\s/>]|\sslot(?:-scope)?=/.test(source)],
    ['condition', /\s(?:wx:|a:|s-|tt:|jd:|xhs:|qq:|ks:|ty:|has:)(?:if|elif|else)[=\s/>]/.test(source) || (template.platform === 'harmony' && /\s(?:if|elif|else)[=\s/>]/.test(source))],
    ['loop', /\s(?:wx:for|a:for|s-for|tt:for|jd:for|xhs:for|qq:for|ks:for|ty:for|has:for)[=\s/>]/.test(source) || (template.platform === 'harmony' && /\sfor=/.test(source))],
    ['event', /\s(?:bind|catch|capture-bind|capture-catch|on[A-Z]|catch[A-Z])[^\s=<>]*=/.test(source)],
    ['script-module', /<(?:wxs|sjs|jds|qs|ks|filter|import-sjs|hjs)[\s/>]/.test(source)],
    ['template-declaration', /<template\s[^>]*\bname=/.test(source)],
    ['template-reference', /<template\s[^>]*\bis=/.test(source)],
    ['interpolation', source.includes('{{')],
    ['large-template', source.length >= 32_768],
  ]
  return features.filter(([, present]) => present).map(([name]) => name)
}

/** 每个冻结文件都执行完整契约，不按相同内容折叠框架、模式与路径。 */
export function runMatrixCases(api: TemplateApi, templates: readonly MatrixTemplateCase[], profiles: readonly CorpusProfile[], resolverFactory?: ResolverFactory, baseline?: XmlParserConstructor): MatrixCaseReport {
  const report: MatrixCaseReport = { quotaEligible: false, templates: templates.length, uniqueContents: new Set(templates.map(template => template.sha256)).size, accepted: true, valid: 0, invalid: 0, pending: 0, entries: { default: entrySummary(), resolver: entrySummary() }, differential: xmlDifferentialSummary(), platforms: {}, cells: {}, observedFeatures: {}, failures: [] }
  const byProfile = new Map(profiles.map(profile => [profile.id, profile]))
  for (const template of templates) {
    const profile = byProfile.get(template.profileId)
    const platform = report.platforms[template.platform] ??= counts()
    const cell = report.cells[template.generationId] ??= { ...counts(), framework: template.framework, version: template.version, target: template.target, mode: template.mode }
    const features = observedFeatures(template)
    const expectation = template.expectation ?? 'valid'
    for (const target of [report, platform, cell]) {
      target[expectation]++
      for (const feature of features) {
        target.observedFeatures[feature] = (target.observedFeatures[feature] ?? 0) + 1
      }
    }
    platform.templates++
    cell.templates++
    const options: ParseOptions = profile ? { platform: profile.parserPlatform, syntax: profile.syntax, rawTags: profile.rawTags } : {}
    const fail = (entry: MatrixFailure['entry'], error: unknown) => {
      report.failures.push({ ...template, entry, stage: error instanceof CorpusAssertionError ? error.stage : 'exception', message: error instanceof Error ? error.message : String(error) })
    }
    const run = (entry: 'default' | 'resolver', selected: ParseOptions) => {
      try {
        if (!profile || profile.platform !== template.platform) {
          throw new CorpusAssertionError('profile', `Missing or mismatched frozen matrix profile: ${template.profileId}`)
        }
        if (expectation === 'invalid' && (!template.diagnosticCodes?.length || !template.evidence?.length)) {
          throw new CorpusAssertionError('classification', 'Known-invalid matrix output requires frozen diagnostic codes and independent evidence.')
        }
        addMetrics(report.entries[entry], assertTemplate(api, template.source, selected, expectation, template.diagnosticCodes))
        return true
      }
      catch (error) {
        report.entries[entry].failed++
        fail(entry, error)
        return false
      }
    }
    let accepted = run('default', options)
    if (profile?.resolver === 'babel') {
      const resolver = resolverFactory?.(profile)
      if (!resolver) {
        fail('resolver', new CorpusAssertionError('resolver', 'Frozen resolver profile requires an explicit resolver factory.'))
        report.entries.resolver.failed++
        accepted = false
      }
      else {
        accepted = run('resolver', { ...options, resolveScriptBoundary: resolver }) && accepted
      }
    }
    if (expectation !== 'valid') {
      report.differential.skipped++
      const reason = expectation === 'invalid' ? 'known-invalid' : 'pending-classification'
      report.differential.reasons[reason] = (report.differential.reasons[reason] ?? 0) + 1
    }
    else if (profile && profile.platform === template.platform) {
      try {
        assertXmlDifferential(api, baseline, template.source, options, report.differential)
      }
      catch (error) {
        fail('differential', error)
        accepted = false
      }
    }
    else {
      report.differential.skipped++
      report.differential.reasons.profile = (report.differential.reasons.profile ?? 0) + 1
    }
    platform[accepted ? 'passed' : 'failed']++
    cell[accepted ? 'passed' : 'failed']++
    report.accepted &&= accepted
  }
  return report
}
