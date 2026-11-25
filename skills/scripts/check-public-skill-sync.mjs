#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import YAML from 'yaml'
import skillCases from '../../maintainers/skillValidation/cases.json' with { type: 'json' }
import skillFeedback from '../../maintainers/skillValidation/feedback.json' with { type: 'json' }
import { validateCaseCatalog, validateEvidenceReport, validateFeedbackCatalog } from '../../scripts/skillValidation/contracts.mjs'
import { hashSkillTree } from '../../scripts/skillValidation/fixtures.mjs'
import { distribution } from './distribution.mjs'

const SKILLS_ROOT = 'skills'
const CONSUMER_GUIDE = 'website/guide/skills.md'
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---/
const MAIN_SKILL_CASES_REGEX = /const MAIN_SKILL_CASES = \{([\s\S]*?)\n\}/
const SCORING_SKILL_KEY_REGEX = /^\s{2}'([^']+)':/gm
const QUOTED_INTERFACE_REGEX = /^\s+(display_name|short_description|default_prompt):\s+(['"]).*\2$/gm
const SCORING_MAP_FILE = 'skills/scripts/score-skill-trigger-regression.mjs'
const NON_PUBLIC_SCORING_GROUPS = new Set(['recent-capability-routing'])
const TEMPLATE_SKILLS_BY_FRAMEWORK = {
  native: ['weapp-vite-best-practices'],
  wevu: ['weapp-vite-best-practices', 'weapp-vite-vue-sfc-best-practices', 'wevu-best-practices'],
  react: ['weapp-vite-best-practices', 'weapp-vite-react-best-practices'],
}

async function discoverPublicSkills() {
  const entries = await fs.readdir(SKILLS_ROOT, { withFileTypes: true })
  const skills = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }
    const skillFile = path.join(SKILLS_ROOT, entry.name, 'SKILL.md')
    try {
      await fs.access(skillFile)
      skills.push(entry.name)
    }
    catch {}
  }

  return skills.sort()
}

function readFrontmatter(source, file) {
  const match = source.match(FRONTMATTER_REGEX)
  if (!match?.[1]) {
    throw new Error(`${file}: missing YAML frontmatter`)
  }
  return YAML.parse(match[1])
}

async function validateScoringMap(skills, issues) {
  const source = await fs.readFile(SCORING_MAP_FILE, 'utf8')
  const block = source.match(MAIN_SKILL_CASES_REGEX)?.[1]
  if (!block) {
    issues.push(`${SCORING_MAP_FILE}: missing MAIN_SKILL_CASES mapping`)
    return
  }

  const mappedSkills = new Set(
    [...block.matchAll(SCORING_SKILL_KEY_REGEX)]
      .map(match => match[1])
      .filter(name => !NON_PUBLIC_SCORING_GROUPS.has(name)),
  )

  for (const name of skills) {
    if (!mappedSkills.has(name)) {
      issues.push(`${SCORING_MAP_FILE}: MAIN_SKILL_CASES missing public skill ${name}`)
    }
  }
  for (const name of mappedSkills) {
    if (!skills.includes(name)) {
      issues.push(`${SCORING_MAP_FILE}: MAIN_SKILL_CASES contains unknown public skill ${name}`)
    }
  }
}

async function validateSkill(name, issues) {
  const skillFile = path.join(SKILLS_ROOT, name, 'SKILL.md')
  const agentFile = path.join(SKILLS_ROOT, name, 'agents/openai.yaml')
  const skillSource = await fs.readFile(skillFile, 'utf8')
  const frontmatter = readFrontmatter(skillSource, skillFile)

  if (frontmatter?.name !== name) {
    issues.push(`${skillFile}: frontmatter name must match directory name ${name}`)
  }

  let agentSource
  try {
    agentSource = await fs.readFile(agentFile, 'utf8')
  }
  catch {
    issues.push(`${agentFile}: missing agents metadata`)
    return
  }

  const agent = YAML.parse(agentSource)
  const interfaceConfig = agent?.interface
  const shortDescription = interfaceConfig?.short_description
  const quotedFields = new Set([...agentSource.matchAll(QUOTED_INTERFACE_REGEX)].map(match => match[1]))

  for (const field of ['display_name', 'short_description', 'default_prompt']) {
    if (typeof interfaceConfig?.[field] !== 'string' || !interfaceConfig[field].trim()) {
      issues.push(`${agentFile}: interface.${field} must be a non-empty string`)
    }
    if (!quotedFields.has(field)) {
      issues.push(`${agentFile}: interface.${field} must use a quoted scalar`)
    }
  }

  if (typeof shortDescription === 'string') {
    const length = [...shortDescription].length
    if (length < 25 || length > 64) {
      issues.push(`${agentFile}: short_description must be 25-64 characters, got ${length}`)
    }
  }

  if (!interfaceConfig?.default_prompt?.startsWith(`Use $${name}`)) {
    issues.push(`${agentFile}: default_prompt must start with "Use $${name}"`)
  }
  if (agent?.policy?.allow_implicit_invocation !== true) {
    issues.push(`${agentFile}: policy.allow_implicit_invocation must be true`)
  }
}
async function validateDistribution(skills, issues) {
  const categories = [...distribution.optional, ...distribution.contributor]
  const turbo = JSON.parse(await fs.readFile('turbo.json', 'utf8'))
  const policy = JSON.parse(await fs.readFile('.github/repoctl-auto-changeset.json', 'utf8'))
  const guide = await fs.readFile(CONSUMER_GUIDE, 'utf8')
  const sharedInputs = ['skills/distribution.json', 'skills/scripts/distribution.mjs', 'skills/scripts/sync-package-skills.mjs']
  for (const [owner, config] of Object.entries(distribution.packages)) {
    categories.push(...config.skills)
    const pkg = JSON.parse(await fs.readFile(`${config.directory}/package.json`, 'utf8'))
    if (pkg.name !== owner || !pkg.files.includes('skills') || !pkg.scripts.prepack?.includes('sync-package-skills.mjs')) {
      issues.push(`${owner}: package name, files or prepack does not include owned skills`)
    }
    const task = turbo.tasks[`${owner}#build`]
    for (const input of [...sharedInputs, ...config.skills.map(name => `skills/${name}/**`)]) {
      if (!task?.inputs?.includes(`$TURBO_ROOT$/${input}`)) {
        issues.push(`${owner}: build cache missing ${input}`)
      }
    }
    if (!task?.outputs?.includes('skills/**')) {
      issues.push(`${owner}: build cache does not restore skills`)
    }
    for (const name of config.skills) {
      if (!guide.includes(name)) {
        issues.push(`${CONSUMER_GUIDE}: missing package skill ${name}`)
      }
      if (!policy.paths.some(entry => entry.packages.includes(owner) && entry.patterns.includes(`skills/${name}/**`))) {
        issues.push(`${owner}: release policy missing ${name}`)
      }
      for await (const file of fs.glob(`skills/${name}/**/*.md`)) {
        const source = await fs.readFile(file, 'utf8')
        const links = [...source.matchAll(/\]\(([^\s)#]+)(?:#[^)]*)?\)/g)].map(match => match[1])
        const references = [...source.matchAll(/`(references\/[^`#]+)(?:#[^`]*)?`/g)].map(match => match[1])
        for (const reference of [...links, ...references]) {
          if (/^(?:[a-z]+:|\/|#)/i.test(reference)) {
            continue
          }
          const target = path.resolve(path.dirname(file), reference)
          const root = path.resolve('skills', name)
          if (!target.startsWith(`${root}${path.sep}`)) {
            issues.push(`${file}: reference escapes its skill: ${reference}`)
            continue
          }
          try {
            await fs.access(target)
          }
          catch {
            issues.push(`${file}: missing reference ${reference}`)
          }
        }
      }
    }
  }
  for (const input of sharedInputs) {
    if (!policy.paths.some(entry => entry.patterns.includes(input) && Object.keys(distribution.packages).every(owner => entry.packages.includes(owner)))) {
      issues.push(`release policy missing shared skills input ${input}`)
    }
  }
  if (new Set(categories).size !== categories.length || [...categories].sort().join('\n') !== skills.join('\n')) {
    issues.push('distribution.json: every public skill must have exactly one package owner or explicit optional/contributor category')
  }
  const templates = JSON.parse(await fs.readFile('packages/create-weapp-vite/src/templateDefinitions.json', 'utf8'))
  const { generatedAgentGuidelines } = await import('../../packages/create-weapp-vite/src/generated/agents.ts')
  const consumerSkills = Object.values(distribution.packages).flatMap(config => config.skills)
  for (const template of templates) {
    const selected = template.skills
    if (!Array.isArray(selected) || selected.some(name => !consumerSkills.includes(name))) {
      issues.push(`${template.id}: skills must be an array containing only package-owned consumer guidance`)
      continue
    }
    const required = Object.hasOwn(TEMPLATE_SKILLS_BY_FRAMEWORK, template.framework) ? TEMPLATE_SKILLS_BY_FRAMEWORK[template.framework] : undefined
    const selectedSkills = new Set(selected)
    if (!required) {
      issues.push(`${template.id}: unsupported template framework ${template.framework}`)
    }
    else if (selectedSkills.size !== selected.length || selectedSkills.size !== required.length || required.some(name => !selectedSkills.has(name))) {
      issues.push(`${template.id}: ${template.framework} templates must select exactly ${required.join(', ')} without duplicates`)
    }
    const guidance = generatedAgentGuidelines[template.id] ?? ''
    for (const name of skills) {
      if (guidance.includes(`$${name}`) !== selected.includes(name)) {
        issues.push(`${template.id}: template guidance differs from selected skills: ${name}`)
      }
    }
  }
}

async function validateMaintenanceContracts(issues) {
  const caseIssues = validateCaseCatalog(skillCases, distribution.packages)
  issues.push(...caseIssues.map(issue => `skill cases: ${issue.path}: ${issue.code}`))
  if (caseIssues.length) {
    return
  }
  issues.push(...validateFeedbackCatalog(skillFeedback, skillCases).map(issue => `skill feedback: ${issue.path}: ${issue.code}`))
  const args = process.argv.slice(2)
  if (!args.length) {
    return
  }
  if (args.length !== 2 || args[0] !== '--evidence' || !args[1]) {
    issues.push('Usage: check-public-skill-sync.mjs [--evidence <report.json>]')
    return
  }
  const report = JSON.parse(await fs.readFile(args[1], 'utf8'))
  const digests = Object.fromEntries(await Promise.all(Object.values(distribution.packages).flatMap(config => config.skills).map(async name => [name, await hashSkillTree(path.join(SKILLS_ROOT, name))])))
  const recordIssues = validateEvidenceReport(report, skillCases, digests)
  issues.push(...recordIssues.map(issue => `skill evidence: ${issue.path}: ${issue.code}`))
  if (recordIssues.length) {
    return
  }
  const counts = { automaticPassed: 0, aiPassed: 0, humanPassed: 0, failed: 0, unverified: 0 }
  for (const record of report.records) {
    if (record.result === 'failed') {
      counts.failed++
    }
    else if (record.result === 'not-run') {
      counts.unverified++
    }
    else {
      counts[`${record.method}Passed`]++
    }
  }
  return counts
}

async function main() {
  const skills = await discoverPublicSkills()
  const issues = []

  if (skills.length === 0) {
    throw new Error('No public skills found')
  }

  await Promise.all(skills.map(name => validateSkill(name, issues)))
  await validateScoringMap(skills, issues)
  await validateDistribution(skills, issues)
  const evidence = await validateMaintenanceContracts(issues)

  if (issues.length > 0) {
    console.error('[public-skills] contract validation failed:')
    for (const issue of issues.sort()) {
      console.error(`- ${issue}`)
    }
    process.exitCode = 1
    return
  }

  console.log(`[public-skills] validated ${skills.length} public skills, ${Object.keys(distribution.packages).length} package owners and scoped template contracts`)
  console.log(`[skill-cases] checked ${skillCases.cases.length} candidate/approved case contracts; no task executed`)
  if (evidence) {
    console.log(`[skill-evidence] record consistency only, not evidence authenticity: ${JSON.stringify(evidence)}`)
    process.exitCode = evidence.failed ? 1 : evidence.unverified ? 2 : 0
  }
}

await main()
