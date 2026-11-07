import { describe, expect, it } from 'vitest'
import cases from '../../maintainers/skillValidation/cases.json' with { type: 'json' }
import feedback from '../../maintainers/skillValidation/feedback.json' with { type: 'json' }
import distribution from '../../skills/distribution.json' with { type: 'json' }
import { safeProjectFilePath, validateCaseCatalog, validateEvidenceReport, validateFeedbackCatalog } from './contracts.mjs'

interface Confirmation { scope: string, reference: string, subject: string }
interface Review { state: string, confirmation?: Confirmation }
type CaseCatalog = Omit<typeof cases, 'cases'> & { cases: (Omit<typeof cases.cases[number], 'review'> & { review: Review })[] }
type FeedbackCatalog = Omit<typeof feedback, 'items'> & { items: (Omit<typeof feedback.items[number], 'review' | 'recurrenceRefs' | 'caseIds'> & { review: Review, recurrenceRefs?: string[], caseIds?: string[] })[] }
interface RecordEntry {
  criterionId: string
  method: string
  result: string
  evidence: string[]
  reason?: string
  evaluator?: string
  command?: { argv: string[], exitCode: number }
  observation?: { tool: string, checks: { actual: unknown, expected: unknown }[] }
  confirmation?: Confirmation
}
interface EvidenceReport {
  version: number
  caseId: string
  skillDigest: string
  packages: Record<string, string>
  records: RecordEntry[]
}

const catalog = (): CaseCatalog => structuredClone(cases)
const feedbackCatalog = (): FeedbackCatalog => structuredClone(feedback)
const selected = cases.cases[0]!
const digest = 'a'.repeat(64)
const current = { [selected.skill]: digest }
const codes = (issues: { code: string, path: string }[]) => issues.map(issue => issue.code)

function report(): EvidenceReport {
  return {
    version: 1,
    caseId: selected.id,
    skillDigest: digest,
    packages: { 'weapp-vite': '7.4.0' },
    records: selected.criteria.map(criterion => ({
      criterionId: criterion.id,
      method: 'unverified',
      result: 'not-run',
      evidence: [],
      reason: 'No replay has been executed.',
    })),
  }
}

function executed(method = 'automatic'): RecordEntry {
  return {
    criterionId: selected.criteria[0]!.id,
    method,
    result: 'passed',
    evidence: ['replay/build.log'],
    command: { argv: ['pnpm', 'run', 'build'], exitCode: 0 },
  }
}

function validate(value: EvidenceReport) {
  return validateEvidenceReport(value, cases, current)
}

describe('project file safety', () => {
  it.each(['src/pages/inventory/index.vue', 'src/库存.json', 'weapp-vite.config.mjs', '.gitignore'])('accepts portable project file %s', (file) => {
    expect(safeProjectFilePath(file)).toBe(true)
  })

  it.each([
    '',
    '/outside',
    '../outside',
    'src/../outside',
    './src/app.js',
    'src//app.js',
    'src/',
    'C:/outside',
    'C:outside',
    '\\\\server\\share',
    'src\\app.js',
    'src/a\u0000.js',
    'src/a\n.js',
    'src/app.js:stream',
    'src/a?.js',
    'src/a*.js',
    'src/a<.js',
    'src/CON',
    'src/nul.js',
    'src/COM1.txt',
    'src/LPT².txt',
    'src/CONOUT$',
    'src/file. ',
    'src/file.',
    'package.json',
    'Package.JSON',
    'pnpm-workspace.yaml',
    '.git/config',
    '.GIT',
    'node_modules/pkg/index.js',
    'src/NODE_MODULES/pkg.js',
    '.agents/skills/x',
  ])('rejects escaping, reserved or Windows-unsafe file %s', (file) => {
    expect(safeProjectFilePath(file)).toBe(false)
  })

  it.each([null, undefined, 12, {}, []])('rejects non-string paths', (file) => {
    expect(safeProjectFilePath(file)).toBe(false)
  })
})

describe('candidate case contract', () => {
  it('accepts complete candidate input data without asserting an outcome', () => {
    expect(validateCaseCatalog(cases, distribution.packages)).toEqual([])
    expect(validateFeedbackCatalog(feedback, cases)).toEqual([])
  })

  it('rejects missing coverage and duplicate case or criterion identities', () => {
    const value = catalog()
    value.cases.pop()
    value.cases[1]!.id = value.cases[0]!.id
    value.cases[0]!.criteria[1]!.id = value.cases[0]!.criteria[0]!.id
    expect(codes(validateCaseCatalog(value, distribution.packages))).toEqual(expect.arrayContaining(['case.missing-skill', 'case.id', 'criterion.id']))
    value.cases[0]!.criteria[0]!.id = ''
    expect(codes(validateCaseCatalog(value, distribution.packages))).toContain('criterion.id')
  })

  it('rejects unsupported skills, unrelated dependencies and duplicate skill coverage', () => {
    const value = catalog()
    value.cases[0]!.skill = 'invented-skill'
    value.cases[1]!.dependencies.push('wevu')
    value.cases[3]!.skill = value.cases[2]!.skill
    expect(codes(validateCaseCatalog(value, distribution.packages))).toEqual(expect.arrayContaining(['case.skill', 'case.dependencies', 'case.missing-skill']))
  })

  it('rejects unsafe, case-colliding and file-directory-colliding inputs', () => {
    const value = catalog()
    Object.assign(value.cases[0]!.files, { '../escape': '', 'SRC/App.js': '', 'src': '' })
    const issues = validateCaseCatalog(value, distribution.packages)
    expect(codes(issues)).toEqual(expect.arrayContaining(['case.file-path', 'case.file-collision']))
    expect(issues.every(issue => typeof issue.path === 'string')).toBe(true)
  })

  it.each([
    { 'src/caf\u00E9.js': 'one', 'src/cafe\u0301.js': 'two' },
    { 'src/caf\u00E9': 'file', 'src/cafe\u0301/nested.js': 'nested' },
  ])('rejects Unicode-equivalent file and directory aliases', (files) => {
    const value = catalog()
    Object.assign(value.cases[0]!.files, files)
    expect(codes(validateCaseCatalog(value, distribution.packages))).toContain('case.file-collision')
  })

  it('requires specific example confirmation, not plan consent', () => {
    const value = catalog()
    const item = value.cases[0]!
    item.review = { state: 'approved', confirmation: { scope: 'plan', reference: 'review/message', subject: item.id } }
    expect(codes(validateCaseCatalog(value, distribution.packages))).toContain('case.review')
    item.review.confirmation!.scope = 'example'
    expect(validateCaseCatalog(value, distribution.packages)).toEqual([])
    item.review.confirmation!.subject = 'publishing-scheme'
    expect(codes(validateCaseCatalog(value, distribution.packages))).toContain('case.review')
  })

  it.each([null, {}, { version: 1, cases: [null] }])('returns issues for malformed catalogs', (value) => {
    expect(validateCaseCatalog(value, distribution.packages).length).toBeGreaterThan(0)
    expect(codes(validateCaseCatalog({ version: 1, cases: [] }, {}))).toContain('distribution.shape')
  })
})

describe('feedback promotion', () => {
  it('cannot turn one run preference into a rule or pretend candidate approval', () => {
    const value = feedbackCatalog()
    const item = value.items[1]!
    item.nextAction = 'rule'
    item.recurrenceRefs = ['run/one']
    expect(codes(validateFeedbackCatalog(value, cases))).toEqual(expect.arrayContaining(['feedback.rule-promotion', 'feedback.run-preference']))
    item.review.confirmation = { scope: 'rule', reference: 'review/message', subject: item.id }
    expect(codes(validateFeedbackCatalog(value, cases))).toContain('feedback.review')
  })

  it('requires distinct recurrence, repository scope and exact human rule confirmation', () => {
    const value = feedbackCatalog()
    const item = value.items[0]!
    item.nextAction = 'rule'
    item.recurrenceRefs = ['run/one', 'run/one']
    item.review = { state: 'approved', confirmation: { scope: 'feedback', reference: 'review/message', subject: item.id } }
    expect(codes(validateFeedbackCatalog(value, cases))).toEqual(expect.arrayContaining(['feedback.rule-promotion', 'feedback.recurrence']))
    item.recurrenceRefs[1] = 'run/two'
    item.review.confirmation!.scope = 'rule'
    expect(validateFeedbackCatalog(value, cases)).toEqual([])
    item.review.confirmation!.subject = value.items[1]!.id
    expect(codes(validateFeedbackCatalog(value, cases))).toContain('feedback.rule-promotion')
  })

  it('binds example actions and any optional case references to existing unique cases', () => {
    const value = feedbackCatalog()
    const item = value.items[0]!
    item.nextAction = 'example'
    expect(codes(validateFeedbackCatalog(value, cases))).toContain('feedback.case-ids')
    item.caseIds = [selected.id, selected.id]
    expect(codes(validateFeedbackCatalog(value, cases))).toContain('feedback.case-ids')
    item.caseIds = [selected.id]
    expect(validateFeedbackCatalog(value, cases)).toEqual([])
    item.nextAction = 'check'
    item.caseIds = ['missing-case']
    expect(codes(validateFeedbackCatalog(value, cases))).toContain('feedback.case-ids')
  })

  it('rejects private absolute references and duplicate feedback identities', () => {
    const value = feedbackCatalog()
    value.items[0]!.sourceRefs = ['/private/session.txt', 'https://user:secret@example.com/log']
    value.items[1]!.id = value.items[0]!.id
    expect(codes(validateFeedbackCatalog(value, cases))).toEqual(expect.arrayContaining(['feedback.sources', 'feedback.id']))
  })
})

describe('per-criterion evidence consistency', () => {
  it('accepts explicit not-run without inventing execution or success', () => {
    expect(validate(report())).toEqual([])
  })

  it('rejects stale skill snapshots, absent actual versions and version ranges', () => {
    const value = report()
    value.skillDigest = 'old'
    value.packages['weapp-vite'] = '^7.4.0'
    expect(codes(validate(value))).toEqual(expect.arrayContaining(['report.stale-digest', 'report.package-version']))
    expect(codes(validate({ ...report(), packages: {} }))).toContain('report.missing-package')
    expect(codes(validateEvidenceReport(report(), cases, {}))).toContain('report.stale-digest')
  })

  it('requires every known criterion exactly once', () => {
    const value = report()
    value.records.pop()
    value.records.push(value.records[0]!, { ...value.records[0]!, criterionId: 'unknown' })
    expect(codes(validate(value))).toEqual(expect.arrayContaining(['record.criterion', 'record.unknown-criterion', 'record.missing-criterion']))
  })

  it('rejects automatic success without an executed check or evidence', () => {
    const value = report()
    const record = executed()
    delete record.command
    record.evidence = []
    value.records[0] = record
    expect(codes(validate(value))).toEqual(expect.arrayContaining(['record.automatic-proof', 'record.evidence']))
  })

  it.each([
    { patch: { command: { argv: [], exitCode: 0 } }, code: 'record.command' },
    { patch: { command: { argv: ['build'], exitCode: 0.5 } }, code: 'record.command' },
    { patch: { observation: { tool: '', checks: [] } }, code: 'record.observation' },
    { patch: { method: 'automatic', result: 'not-run' }, code: 'record.not-run' },
    { patch: { method: 'unknown' }, code: 'record.method' },
    { patch: { result: 'blocked' }, code: 'record.result' },
  ])('rejects malformed execution or result: $code', ({ patch, code }) => {
    const value = report()
    value.records[0] = { ...executed(), ...patch }
    expect(codes(validate(value))).toContain(code)
  })

  it('preserves executed failures and rejects nonzero success', () => {
    const value = report()
    const record = executed()
    record.command!.exitCode = 7
    value.records[0] = record
    expect(codes(validate(value))).toContain('record.false-pass')
    record.result = 'failed'
    expect(validate(value)).toEqual([])
    record.result = 'not-run'
    record.method = 'unverified'
    record.reason = 'Pretending the failed command never ran.'
    expect(codes(validate(value))).toContain('record.unverified-execution')
  })

  it('compares actual observations structurally and rejects mismatched success', () => {
    const value = report()
    const record = executed()
    delete record.command
    record.observation = { tool: 'artifact-check', checks: [{ actual: { pages: ['home'], title: '库存' }, expected: { title: '库存', pages: ['home'] } }] }
    value.records[0] = record
    expect(validate(value)).toEqual([])
    record.observation.checks[0]!.actual = { pages: [] }
    record.command = { argv: ['pnpm', 'run', 'build'], exitCode: 0 }
    expect(codes(validate(value))).toContain('record.false-pass')
    record.result = 'failed'
    expect(validate(value)).toEqual([])
  })

  it('does not allow an AI judgment to replace required automatic artifact checks', () => {
    const value = report()
    value.records[0] = { ...executed('ai'), evaluator: 'blind-judge/session' }
    expect(codes(validate(value))).toContain('record.required-automatic')
    const semantic = selected.criteria.findIndex(criterion => criterion.verification === 'ai')
    value.records[0] = report().records[0]!
    value.records[semantic] = { ...executed('ai'), criterionId: selected.criteria[semantic]!.id }
    expect(codes(validate(value))).toContain('record.evaluator')
    value.records[semantic]!.evaluator = 'blind-judge/session'
    expect(validate(value)).toEqual([])
  })

  it('requires result-scope human confirmation bound to case, criterion and digest', () => {
    const value = report()
    const record = executed('human')
    value.records[0] = record
    record.confirmation = { scope: 'plan', reference: 'review/message', subject: `${value.caseId}:${record.criterionId}:${digest}` }
    expect(codes(validate(value))).toContain('record.human-confirmation')
    record.confirmation.scope = 'result'
    expect(validate(value)).toEqual([])
    record.confirmation.subject = `${value.caseId}:${record.criterionId}:old`
    expect(codes(validate(value))).toContain('record.human-confirmation')
  })

  it('rejects invalid not-run transitions and absent reasons', () => {
    const value = report()
    value.records[0]!.result = 'passed'
    expect(codes(validate(value))).toContain('record.not-run')
    value.records[0] = { ...report().records[0]!, reason: '' }
    expect(codes(validate(value))).toContain('record.reason')
  })

  it('returns issues for malformed reports and referenced case shapes', () => {
    expect(codes(validateEvidenceReport(null, cases, current))).toContain('report.shape')
    expect(codes(validate({ ...report(), caseId: 'absent' }))).toContain('report.case')
    expect(codes(validateEvidenceReport(report(), { version: 1, cases: [{ id: selected.id, criteria: 'invalid' }] }, current))).toContain('report.case-catalog')
  })
})
