import { isDeepStrictEqual } from 'node:util'

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = value => typeof value === 'string' && value.trim().length > 0
const strings = value => Array.isArray(value) && value.length > 0 && value.every(text)
const own = (value, key) => Object.hasOwn(value, key)
const version = value => typeof value === 'string' && /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[\da-z-]+(?:\.[\da-z-]+)*)?(?:\+[\da-z-]+(?:\.[\da-z-]+)*)?$/i.test(value)

function flag(issues, invalid, code, path) {
  if (invalid) {
    issues.push({ code, path })
  }
}

function relativePath(value) {
  if (!text(value) || /[\\<>:"|?*]/.test(value)) {
    return false
  }
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code < 32 || code === 127) {
      return false
    }
  }
  return value.split('/').every(part => part && part !== '.' && part !== '..'
    && !/[. ]$/.test(part) && !/^(?:con|prn|aux|nul|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(part))
}

/** 只接受跨平台安全的项目文件名；调用方仍须隔离根目录并拒绝已有符号链接。 */
export function safeProjectFilePath(value) {
  return relativePath(value) && !value.split('/').some(part =>
    ['.git', 'node_modules', '.agents', 'package.json', 'pnpm-workspace.yaml'].includes(part.toLowerCase()))
}

function sourceReference(value) {
  if (typeof value === 'string' && value.startsWith('https://')) {
    try {
      const url = new URL(value)
      return Boolean(url.hostname) && !url.username && !url.password
    }
    catch {
      return false
    }
  }
  return relativePath(value)
}

function catalogRows(catalog, key, issues) {
  if (!object(catalog) || catalog.version !== 1 || !Array.isArray(catalog[key])) {
    issues.push({ code: 'catalog.shape', path: '$' })
    return []
  }
  return catalog[key]
}

function confirmation(value, scope, subject) {
  return object(value) && value.scope === scope && text(value.reference) && value.subject === subject
}

function reviewValid(review, scope, subject) {
  return object(review) && (review.state === 'candidate'
    ? !own(review, 'confirmation')
    : review.state === 'approved' && confirmation(review.confirmation, scope, subject))
}

function uniqueId(value, seen) {
  if (!text(value) || seen.has(value)) {
    return false
  }
  seen.add(value)
  return true
}

/** 校验四个消费技能的独立项目输入；包与技能归属来自 distribution.packages。 */
export function validateCaseCatalog(catalog, distributionPackages) {
  const issues = []
  const add = (code, path) => issues.push({ code, path })
  const owners = new Map()
  if (!object(distributionPackages)) {
    add('distribution.shape', '$distributionPackages')
    return issues
  }
  for (const [name, config] of Object.entries(distributionPackages)) {
    if (!object(config) || !strings(config.skills)) {
      add('distribution.shape', `$distributionPackages[${JSON.stringify(name)}]`)
      continue
    }
    for (const skill of config.skills) {
      flag(issues, owners.has(skill), 'distribution.duplicate-skill', `$distributionPackages[${JSON.stringify(name)}].skills`)
      owners.set(skill, name)
    }
  }
  flag(issues, owners.size === 0, 'distribution.shape', '$distributionPackages')
  const ids = new Set()
  const covered = new Set()
  for (const [index, item] of catalogRows(catalog, 'cases', issues).entries()) {
    const p = `$.cases[${index}]`
    if (!object(item)) {
      add('case.shape', p)
      continue
    }
    flag(issues, !uniqueId(item.id, ids), 'case.id', `${p}.id`)
    flag(issues, !owners.has(item.skill) || covered.has(item.skill), 'case.skill', `${p}.skill`)
    covered.add(item.skill)
    flag(issues, !['edit-build', 'diagnose'].includes(item.mode), 'case.mode', `${p}.mode`)
    flag(issues, !Array.isArray(item.dependencies) || item.dependencies.length !== 1
    || item.dependencies[0] !== owners.get(item.skill) || !own(distributionPackages, item.dependencies[0]), 'case.dependencies', `${p}.dependencies`)
    flag(issues, !text(item.task), 'case.task', `${p}.task`)
    flag(issues, !reviewValid(item.review, 'example', item.id), 'case.review', `${p}.review`)
    flag(issues, !object(item.files) || Object.keys(item.files).length === 0, 'case.files', `${p}.files`)
    const paths = new Set()
    for (const [file, content] of Object.entries(object(item.files) ? item.files : {})) {
      const at = `${p}.files[${JSON.stringify(file)}]`
      flag(issues, !safeProjectFilePath(file), 'case.file-path', at)
      flag(issues, typeof content !== 'string', 'case.file-content', at)
      const normalized = file.normalize('NFC').toLowerCase()
      flag(issues, paths.has(normalized), 'case.file-collision', at)
      paths.add(normalized)
    }
    for (const file of paths) {
      const parts = file.split('/')
      parts.pop()
      while (parts.length) {
        if (paths.has(parts.join('/'))) {
          add('case.file-collision', `${p}.files`)
          break
        }
        parts.pop()
      }
    }
    flag(issues, !Array.isArray(item.criteria) || item.criteria.length < 3 || item.criteria.length > 5, 'case.criteria', `${p}.criteria`)
    const criteria = new Set()
    for (const [n, criterion] of (Array.isArray(item.criteria) ? item.criteria : []).entries()) {
      const at = `${p}.criteria[${n}]`
      if (!object(criterion)) {
        add('criterion.shape', at)
        continue
      }
      flag(issues, !uniqueId(criterion.id, criteria), 'criterion.id', `${at}.id`)
      flag(issues, !text(criterion.description), 'criterion.description', `${at}.description`)
      flag(issues, !['automatic', 'ai'].includes(criterion.verification), 'criterion.verification', `${at}.verification`)
    }
  }
  for (const skill of owners.keys()) {
    flag(issues, !covered.has(skill), 'case.missing-skill', '$.cases')
  }
  return issues
}

/** 只校验反馈及晋升记录的一致性，不执行晋升，也不认证来源或人的身份。 */
export function validateFeedbackCatalog(feedback, caseCatalog) {
  const issues = []
  const add = (code, path) => issues.push({ code, path })
  flag(issues, !object(caseCatalog) || caseCatalog.version !== 1 || !Array.isArray(caseCatalog.cases), 'feedback.case-catalog', '$caseCatalog')
  const caseIds = new Set((Array.isArray(caseCatalog?.cases) ? caseCatalog.cases : []).map(item => item?.id))
  const ids = new Set()
  for (const [index, item] of catalogRows(feedback, 'items', issues).entries()) {
    const p = `$.items[${index}]`
    if (!object(item)) {
      add('feedback.shape', p)
      continue
    }
    flag(issues, !uniqueId(item.id, ids), 'feedback.id', `${p}.id`)
    flag(issues, !['tool-defect', 'compatibility', 'style-preference', 'verification-gap'].includes(item.category), 'feedback.category', `${p}.category`)
    flag(issues, !['repository', 'run'].includes(item.scope), 'feedback.scope', `${p}.scope`)
    flag(issues, !text(item.summary), 'feedback.summary', `${p}.summary`)
    flag(issues, !strings(item.sourceRefs) || !item.sourceRefs.every(sourceReference), 'feedback.sources', `${p}.sourceRefs`)
    flag(issues, !['tool', 'check', 'example', 'note', 'rule'].includes(item.nextAction), 'feedback.action', `${p}.nextAction`)
    flag(issues, (item.nextAction === 'example' || own(item, 'caseIds')) && (!strings(item.caseIds)
      || new Set(item.caseIds).size !== item.caseIds.length || !item.caseIds.every(id => caseIds.has(id))), 'feedback.case-ids', `${p}.caseIds`)
    const scope = item.nextAction === 'rule' ? 'rule' : 'feedback'
    flag(issues, !reviewValid(item.review, scope, item.id), 'feedback.review', `${p}.review`)
    flag(issues, own(item, 'recurrenceRefs') && (!strings(item.recurrenceRefs) || new Set(item.recurrenceRefs).size !== item.recurrenceRefs.length), 'feedback.recurrence', `${p}.recurrenceRefs`)
    flag(issues, item.nextAction === 'rule' && (item.scope !== 'repository' || item.review?.state !== 'approved'
      || !confirmation(item.review?.confirmation, 'rule', item.id)
      || !strings(item.recurrenceRefs) || new Set(item.recurrenceRefs).size < 2), 'feedback.rule-promotion', `${p}.nextAction`)
    flag(issues, item.category === 'style-preference' && item.scope === 'run' && item.nextAction !== 'note', 'feedback.run-preference', `${p}.nextAction`)
  }
  return issues
}

function validCommand(command) {
  return object(command) && strings(command.argv) && Number.isInteger(command.exitCode)
}

function validObservation(observation) {
  return object(observation) && text(observation.tool) && Array.isArray(observation.checks)
    && observation.checks.length > 0 && observation.checks.every(check =>
    object(check) && own(check, 'actual') && own(check, 'expected')
    && check.actual !== undefined && check.expected !== undefined)
}

/** 校验单次、单技能快照的证据记录；不会执行命令或判断证据是否真实。 */
export function validateEvidenceReport(report, caseCatalog, currentSkillDigests) {
  const issues = []
  const add = (code, path) => issues.push({ code, path })
  if (!object(report) || report.version !== 1 || !Array.isArray(report.records)) {
    add('report.shape', '$')
    return issues
  }
  const item = (Array.isArray(caseCatalog?.cases) ? caseCatalog.cases : []).find(candidate => candidate?.id === report.caseId)
  if (!item) {
    add('report.case', '$.caseId')
    return issues
  }
  if (caseCatalog.version !== 1 || !strings(item.dependencies) || !Array.isArray(item.criteria)
    || !item.criteria.every(criterion => object(criterion) && text(criterion.id))) {
    add('report.case-catalog', '$caseCatalog')
    return issues
  }
  flag(issues, !text(report.skillDigest) || !object(currentSkillDigests) || !own(currentSkillDigests, item.skill)
  || !text(currentSkillDigests[item.skill]) || report.skillDigest !== currentSkillDigests[item.skill], 'report.stale-digest', '$.skillDigest')
  flag(issues, !object(report.packages), 'report.packages', '$.packages')
  for (const name of item.dependencies ?? []) {
    flag(issues, !object(report.packages) || !own(report.packages, name), 'report.missing-package', '$.packages')
  }
  for (const [name, actual] of Object.entries(object(report.packages) ? report.packages : {})) {
    flag(issues, !version(actual), 'report.package-version', `$.packages[${JSON.stringify(name)}]`)
  }
  const criteria = new Map((item.criteria ?? []).map(criterion => [criterion.id, criterion]))
  const seen = new Set()
  for (const [index, record] of report.records.entries()) {
    const p = `$.records[${index}]`
    if (!object(record)) {
      add('record.shape', p)
      continue
    }
    flag(issues, !uniqueId(record.criterionId, seen), 'record.criterion', `${p}.criterionId`)
    const criterion = criteria.get(record.criterionId)
    flag(issues, !criterion, 'record.unknown-criterion', `${p}.criterionId`)
    flag(issues, !['automatic', 'ai', 'human', 'unverified'].includes(record.method), 'record.method', `${p}.method`)
    flag(issues, !['passed', 'failed', 'not-run'].includes(record.result), 'record.result', `${p}.result`)
    flag(issues, !Array.isArray(record.evidence) || !record.evidence.every(text), 'record.evidence', `${p}.evidence`)
    flag(issues, (record.method === 'unverified') !== (record.result === 'not-run'), 'record.not-run', `${p}.result`)
    if (record.method === 'unverified') {
      flag(issues, !text(record.reason), 'record.reason', `${p}.reason`)
      flag(issues, own(record, 'command') || own(record, 'observation') || own(record, 'confirmation') || own(record, 'evaluator'), 'record.unverified-execution', p)
      continue
    }
    flag(issues, !strings(record.evidence), 'record.evidence', `${p}.evidence`)
    flag(issues, own(record, 'command') && !validCommand(record.command), 'record.command', `${p}.command`)
    flag(issues, own(record, 'observation') && !validObservation(record.observation), 'record.observation', `${p}.observation`)
    flag(issues, record.method === 'automatic' && !validCommand(record.command) && !validObservation(record.observation), 'record.automatic-proof', p)
    flag(issues, record.result === 'passed' && ((validCommand(record.command) && record.command.exitCode !== 0)
      || (validObservation(record.observation) && record.observation.checks.some(check => !isDeepStrictEqual(check.actual, check.expected)))), 'record.false-pass', `${p}.result`)
    flag(issues, record.method === 'ai' && !text(record.evaluator), 'record.evaluator', `${p}.evaluator`)
    flag(issues, record.method === 'ai' && criterion?.verification === 'automatic', 'record.required-automatic', `${p}.method`)
    flag(issues, record.method === 'human' && !confirmation(record.confirmation, 'result', `${item.id}:${record.criterionId}:${report.skillDigest}`), 'record.human-confirmation', `${p}.confirmation`)
    flag(issues, record.method !== 'human' && own(record, 'confirmation'), 'record.confirmation-method', `${p}.confirmation`)
  }
  for (const id of criteria.keys()) {
    flag(issues, !seen.has(id), 'record.missing-criterion', '$.records')
  }
  return issues
}
