import type { ParseOptions } from '../../../packages/wxml/src/types'
import type { CorpusDocument, CorpusOrigin, CorpusProfile } from '../types'
import type { AssertionMetrics, TemplateApi } from './types'
import type { XmlDifferentialSummary, XmlParserConstructor } from './xml'
import { assertTemplate } from './index'
import { CorpusAssertionError } from './types'
import { assertXmlDifferential, xmlDifferentialSummary } from './xml'

export interface CorpusFailure {
  sha256: string
  profileId: string
  entry: 'default' | 'resolver' | 'differential'
  stage: string
  message: string
  source: string
  origins: CorpusOrigin[]
}

export interface CorpusEntrySummary {
  passed: number
  failed: number
  tokens: number
  nodes: number
  elements: number
  attributes: number
  edits: number
}

export interface CorpusCaseReport {
  cases: number
  documents: number
  pending: number
  accepted: boolean
  entries: { default: CorpusEntrySummary, resolver: CorpusEntrySummary }
  differential: XmlDifferentialSummary
  platforms: Record<string, { valid: number, invalid: number, pending: number, failed: number }>
  failures: CorpusFailure[]
}

export type ResolverFactory = (profile: CorpusProfile) => NonNullable<ParseOptions['resolveScriptBoundary']> | undefined

function summary(): CorpusEntrySummary {
  return { passed: 0, failed: 0, tokens: 0, nodes: 0, elements: 0, attributes: 0, edits: 0 }
}

function addMetrics(summary: CorpusEntrySummary, metrics: AssertionMetrics) {
  summary.passed++
  for (const key of ['tokens', 'nodes', 'elements', 'attributes', 'edits'] as const) {
    summary[key] += metrics[key]
  }
}

/** 同一内容可有不同来源方言，按内容、配置、预期及诊断分别执行。 */
export function runCorpusCases(api: TemplateApi, documents: readonly CorpusDocument[], profiles: readonly CorpusProfile[], resolverFactory?: ResolverFactory, baseline?: XmlParserConstructor): CorpusCaseReport {
  const report: CorpusCaseReport = { cases: 0, documents: documents.length, pending: 0, accepted: true, entries: { default: summary(), resolver: summary() }, differential: xmlDifferentialSummary(), platforms: {}, failures: [] }
  const byProfile = new Map(profiles.map(profile => [profile.id, profile]))
  const seen = new Set<string>()
  for (const document of documents) {
    for (const origin of document.origins) {
      const codes = [...origin.diagnosticCodes ?? []].sort()
      const identity = JSON.stringify([document.sha256, origin.profileId, origin.expectation, codes])
      if (seen.has(identity)) {
        continue
      }
      seen.add(identity)
      report.cases++
      const platform = report.platforms[origin.platform] ??= { valid: 0, invalid: 0, pending: 0, failed: 0 }
      platform[origin.expectation]++
      if (origin.expectation === 'pending') {
        report.pending++
      }
      const profile = byProfile.get(origin.profileId)
      const options: ParseOptions = profile ? { platform: profile.parserPlatform, syntax: profile.syntax, rawTags: profile.rawTags } : {}
      const origins = document.origins.filter(candidate => candidate.profileId === origin.profileId && candidate.expectation === origin.expectation)
      const run = (entry: 'default' | 'resolver', selected: ParseOptions) => {
        try {
          if (!profile) {
            throw new CorpusAssertionError('profile', `Unknown frozen profile: ${origin.profileId}`)
          }
          addMetrics(report.entries[entry], assertTemplate(api, document.source, selected, origin.expectation, codes))
          return true
        }
        catch (error) {
          report.entries[entry].failed++
          report.failures.push({ sha256: document.sha256, profileId: origin.profileId, entry, source: document.source, origins, stage: error instanceof CorpusAssertionError ? error.stage : 'exception', message: error instanceof Error ? error.message : String(error) })
          return false
        }
      }
      const defaultPassed = run('default', options)
      let accepted = defaultPassed
      if (profile?.resolver === 'babel') {
        const resolver = resolverFactory?.(profile)
        if (!resolver) {
          report.failures.push({ sha256: document.sha256, profileId: profile.id, entry: 'resolver', source: document.source, origins, stage: 'resolver', message: 'Frozen resolver profile requires an explicit resolver factory.' })
          report.entries.resolver.failed++
          accepted = false
        }
        else {
          accepted = run('resolver', { ...options, resolveScriptBoundary: resolver })
        }
      }
      if (origin.expectation === 'valid' && profile) {
        try {
          assertXmlDifferential(api, baseline, document.source, options, report.differential)
        }
        catch (error) {
          report.failures.push({ sha256: document.sha256, profileId: origin.profileId, entry: 'differential', source: document.source, origins, stage: error instanceof CorpusAssertionError ? error.stage : 'exception', message: String(error) })
          accepted = false
        }
      }
      else {
        report.differential.skipped++
        report.differential.reasons[origin.expectation] = (report.differential.reasons[origin.expectation] ?? 0) + 1
      }
      if (!accepted) {
        report.accepted = false
        platform.failed++
      }
    }
  }
  return report
}
