import { check, incomplete } from './report.mjs'

/** 合并保护策略只接受已批准的主分支、汇总检查和 Actions 应用，不允许弱化新鲜度或管理员约束。 */
export function validateMergeProtectionPolicy(policy) {
  if (!policy || policy.branch !== 'main' || policy.requiredStatusCheck !== 'PR snapshot checks'
    || policy.integrationId !== 15368 || policy.strict !== true || policy.enforceAdmins !== true) {
    throw new TypeError('无效的 .github/pr-admission.json mergeProtection 配置')
  }
  return policy
}

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const positiveId = value => Number.isSafeInteger(value) && value > 0
const passed = results => results.every(result => result.status === 'pass')

function statusChecks(value, integrationKey, requiredIntegration) {
  if (!Array.isArray(value) || value.some(row => !object(row) || typeof row.context !== 'string' || !row.context
    || (requiredIntegration && !Object.hasOwn(row, integrationKey))
    || (row[integrationKey] !== undefined && row[integrationKey] !== null && !Number.isSafeInteger(row[integrationKey])))) {
    throw new TypeError('必需状态检查 API 响应无效，无法核验检查名称和应用来源')
  }
  return value.map(row => ({ context: row.context, integrationId: row[integrationKey] }))
}

function protectionChecks(policy, source, { enabled, checks, strict, enforceAdmins }) {
  const expected = { context: policy.requiredStatusCheck, integrationId: policy.integrationId }
  const actual = checks.find(row => row.context === expected.context && row.integrationId === expected.integrationId)
    ?? checks.find(row => row.context === expected.context)
  return [
    check(`${source} 启用合并保护`, true, enabled),
    check(`${source} 必需状态检查及应用`, expected, actual),
    check(`${source} 合并前必须更新分支`, policy.strict, strict),
    check(`${source} 管理员及其他主体不可绕过`, policy.enforceAdmins, enforceAdmins),
  ]
}

function classicChecks(policy, protection) {
  if (!object(protection) || !object(protection.enforce_admins) || typeof protection.enforce_admins.enabled !== 'boolean'
    || (Object.hasOwn(protection, 'enabled') && typeof protection.enabled !== 'boolean')) {
    throw new TypeError('分支保护 API 响应缺少配置字段，无法完成核验')
  }
  const required = protection.required_status_checks ?? null
  if (required !== null && (!object(required) || typeof required.strict !== 'boolean'
    || (Object.hasOwn(required, 'enforcement_level') && !['off', 'non_admins', 'everyone'].includes(required.enforcement_level)))) {
    throw new TypeError('分支保护 API 返回了无效的严格状态检查配置')
  }
  return protectionChecks(policy, `${policy.branch} 经典分支保护`, {
    enabled: protection.enabled !== false && required?.enforcement_level !== 'off',
    checks: required === null ? [] : statusChecks(required.checks, 'app_id', true),
    strict: required === null ? false : required.strict,
    enforceAdmins: protection.enforce_admins.enabled && required?.enforcement_level !== 'non_admins',
  })
}

function ruleChecks(rule) {
  if (!object(rule.parameters) || typeof rule.parameters.strict_required_status_checks_policy !== 'boolean') {
    throw new TypeError('有效分支规则 API 返回了无效的严格状态检查配置')
  }
  return {
    checks: statusChecks(rule.parameters.required_status_checks, 'integration_id', false),
    strict: rule.parameters.strict_required_status_checks_policy,
  }
}

function rulesetChecks(policy, rule, ruleset) {
  if (!object(ruleset) || ruleset.id !== rule.ruleset_id || ruleset.source !== rule.ruleset_source
    || ruleset.source_type !== rule.ruleset_source_type || ruleset.target !== 'branch'
    || !['active', 'disabled', 'evaluate'].includes(ruleset.enforcement)
    || !Array.isArray(ruleset.bypass_actors) || !Array.isArray(ruleset.rules)
    || ruleset.bypass_actors.some(actor => !object(actor)
      || !['Integration', 'OrganizationAdmin', 'RepositoryRole', 'Team', 'DeployKey', 'User'].includes(actor.actor_type)
      || (['Integration', 'RepositoryRole', 'Team', 'User'].includes(actor.actor_type) && !positiveId(actor.actor_id))
      || (actor.bypass_mode !== undefined && !['always', 'pull_request', 'exempt'].includes(actor.bypass_mode)))
    || ruleset.rules.some(row => !object(row) || typeof row.type !== 'string')
    || (Object.hasOwn(ruleset, 'current_user_can_bypass')
      && !['always', 'pull_requests_only', 'never', 'exempt'].includes(ruleset.current_user_can_bypass))) {
    throw new TypeError('规则集 API 缺少匹配的来源、执行状态或可见的 bypass_actors，无法完成核验')
  }
  const configured = ruleset.rules.filter(row => row.type === 'required_status_checks').map(ruleChecks)
  const effective = ruleChecks(rule)
  const matching = configured.find(value => value.strict === policy.strict
    && value.checks.some(row => row.context === policy.requiredStatusCheck && row.integrationId === policy.integrationId))
  return protectionChecks(policy, `${policy.branch} 规则集 ${ruleset.id}`, {
    enabled: ruleset.enforcement === 'active' && Boolean(matching),
    ...effective,
    enforceAdmins: ruleset.bypass_actors.length === 0
      && (!Object.hasOwn(ruleset, 'current_user_can_bypass') || ruleset.current_user_can_bypass === 'never'),
  })
}

/** 仅通过显式 GET 核验实际保护；经典保护足够时不额外读取规则集，404 本身不作为无保护的证据。 */
export async function checkLiveMergeProtection(policy, { repository, root, gh }) {
  const results = []
  try {
    validateMergeProtectionPolicy(policy)
    if (!/^[\w.-]+\/[\w.-]+$/u.test(repository ?? '') || typeof gh !== 'function') {
      throw new TypeError('合并保护核验需要 owner/repo 和只读 gh 查询器')
    }
    const get = async endpoint => JSON.parse(await gh(['api', '--method', 'GET', endpoint], root))
    let protection
    try {
      protection = await get(`repos/${repository}/branches/${encodeURIComponent(policy.branch)}/protection`)
    }
    catch (error) {
      if (!/\bHTTP 404\b/u.test(error.message)) {
        throw error
      }
    }
    if (protection !== undefined) {
      const classic = classicChecks(policy, protection)
      if (passed(classic)) {
        return classic
      }
      results.push(...classic)
    }
    const rules = []
    for (let page = 1; ; page++) {
      const rows = await get(`repos/${repository}/rules/branches/${encodeURIComponent(policy.branch)}?per_page=100&page=${page}`)
      if (!Array.isArray(rows) || rows.some(row => !object(row) || typeof row.type !== 'string')) {
        throw new TypeError('有效分支规则 API 响应不是有效规则数组')
      }
      rules.push(...rows)
      if (rows.length < 100) {
        break
      }
    }
    const required = rules.filter(rule => rule.type === 'required_status_checks')
    for (const rule of required) {
      if (!positiveId(rule.ruleset_id) || !['Repository', 'Organization', 'Enterprise'].includes(rule.ruleset_source_type)
        || typeof rule.ruleset_source !== 'string' || !rule.ruleset_source) {
        throw new TypeError('有效分支规则 API 缺少规则集来源，无法核验绕过权限')
      }
      ruleChecks(rule)
    }
    const rulesets = new Map()
    for (const rule of required) {
      if (!rulesets.has(rule.ruleset_id)) {
        rulesets.set(rule.ruleset_id, await get(`repos/${repository}/rulesets/${rule.ruleset_id}?includes_parents=true`))
      }
      const effective = rulesetChecks(policy, rule, rulesets.get(rule.ruleset_id))
      if (passed(effective)) {
        return effective
      }
      results.push(...effective)
    }
    if (results.length === 0) {
      results.push(check(`${repository}: ${policy.branch} 存在强制合并新鲜度保护`, true, false))
    }
  }
  catch (error) {
    results.push(incomplete(`${repository}: 合并新鲜度保护`, error instanceof SyntaxError ? 'GitHub API 响应不是有效 JSON' : error.message))
  }
  return results
}
