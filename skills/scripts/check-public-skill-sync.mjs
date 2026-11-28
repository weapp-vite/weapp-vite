#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import YAML from 'yaml'
import skillCases from '../../maintainers/skillValidation/cases.json' with { type: 'json' }
import skillFeedback from '../../maintainers/skillValidation/feedback.json' with { type: 'json' }
import { validateCaseCatalog, validateEvidenceReport, validateFeedbackCatalog } from '../../scripts/skillValidation/contracts.mjs'
import { hashSkillTree } from '../../scripts/skillValidation/fixtures.mjs'
import { discoverPackageSkills, discoverPublicSkillSources } from './package-skills.mjs'

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
const OBSOLETE_DISTRIBUTION_FILES = [
  'skills/distribution.json',
  'skills/scripts/distribution.mjs',
  'skills/scripts/sync-package-skills.mjs',
]

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

async function validateSkill(source, issues) {
  const skillRoot = path.resolve(source.directory)
  const skillFile = path.join(skillRoot, 'SKILL.md')
  const agentFile = path.join(skillRoot, 'agents/openai.yaml')
  const skillSource = await fs.readFile(skillFile, 'utf8')
  const frontmatter = readFrontmatter(skillSource, skillFile)

  if (frontmatter?.name !== source.name) {
    issues.push(`${path.relative(process.cwd(), skillFile)}: frontmatter name must match directory name ${source.name}`)
  }

  let agentSource
  try {
    agentSource = await fs.readFile(agentFile, 'utf8')
  }
  catch {
    issues.push(`${path.relative(process.cwd(), agentFile)}: missing agents metadata`)
    return
  }

  const agent = YAML.parse(agentSource)
  const interfaceConfig = agent?.interface
  const shortDescription = interfaceConfig?.short_description
  const quotedFields = new Set([...agentSource.matchAll(QUOTED_INTERFACE_REGEX)].map(match => match[1]))

  for (const field of ['display_name', 'short_description', 'default_prompt']) {
    if (typeof interfaceConfig?.[field] !== 'string' || !interfaceConfig[field].trim()) {
      issues.push(`${path.relative(process.cwd(), agentFile)}: interface.${field} must be a non-empty string`)
    }
    if (!quotedFields.has(field)) {
      issues.push(`${path.relative(process.cwd(), agentFile)}: interface.${field} must use a quoted scalar`)
    }
  }

  if (typeof shortDescription === 'string') {
    const length = [...shortDescription].length
    if (length < 25 || length > 64) {
      issues.push(`${path.relative(process.cwd(), agentFile)}: short_description must be 25-64 characters, got ${length}`)
    }
  }

  if (!interfaceConfig?.default_prompt?.startsWith(`Use $${source.name}`)) {
    issues.push(`${path.relative(process.cwd(), agentFile)}: default_prompt must start with "Use $${source.name}"`)
  }
  if (agent?.policy?.allow_implicit_invocation !== true) {
    issues.push(`${path.relative(process.cwd(), agentFile)}: policy.allow_implicit_invocation must be true`)
  }
}

async function validateSkillReferences(source, issues) {
  const root = path.resolve(source.directory)
  for await (const file of fs.glob('**/*.md', { cwd: root })) {
    const absoluteFile = path.join(root, file)
    const relativeFile = path.relative(process.cwd(), absoluteFile)
    const content = await fs.readFile(absoluteFile, 'utf8')
    const links = [...content.matchAll(/\]\(([^\s)#]+)(?:#[^)]*)?\)/g)].map(match => match[1])
    const references = [...content.matchAll(/`(references\/[^`#]+)(?:#[^`]*)?`/g)].map(match => match[1])
    for (const reference of [...links, ...references]) {
      if (/^(?:[a-z]+:|\/|#)/i.test(reference)) {
        continue
      }
      const target = path.resolve(path.dirname(absoluteFile), reference)
      if (!target.startsWith(`${root}${path.sep}`)) {
        issues.push(`${relativeFile}: reference escapes its skill: ${reference}`)
        continue
      }
      try {
        await fs.access(target)
      }
      catch {
        issues.push(`${relativeFile}: missing reference ${reference}`)
      }
    }
  }
}

async function validateDistribution(sources, packageSkills, issues) {
  const names = sources.map(source => source.name)
  if (new Set(names).size !== names.length) {
    issues.push('every public skill must have exactly one repository or package source')
  }
  for (const obsolete of OBSOLETE_DISTRIBUTION_FILES) {
    if (await fs.access(obsolete).then(() => true, error => error.code === 'ENOENT' ? false : Promise.reject(error))) {
      issues.push(`${obsolete}: package skills must be maintained directly in their owning package`)
    }
  }

  const turbo = JSON.parse(await fs.readFile('turbo.json', 'utf8'))
  const policy = JSON.parse(await fs.readFile('.github/repoctl-auto-changeset.json', 'utf8'))
  const guide = await fs.readFile(CONSUMER_GUIDE, 'utf8')
  const packageConfigs = Object.fromEntries(packageSkills.map(pkg => [pkg.name, { directory: pkg.directory, skills: pkg.skills }]))
  const consumerSkills = packageSkills.flatMap(pkg => pkg.skills)
  const obsoletePolicyPatterns = new Set([
    ...OBSOLETE_DISTRIBUTION_FILES,
    ...consumerSkills.map(name => `skills/${name}/**`),
  ])
  for (const entry of policy.paths) {
    for (const pattern of entry.patterns) {
      if (obsoletePolicyPatterns.has(pattern)) {
        issues.push(`.github/repoctl-auto-changeset.json: obsolete package skill mapping ${pattern}`)
      }
    }
  }

  for (const pkg of packageSkills) {
    if (typeof pkg.name !== 'string' || !pkg.name || pkg.manifest.private === true || !pkg.manifest.files?.includes('skills')) {
      issues.push(`${pkg.directory}: publishable package must include its committed skills directory`)
    }
    const generationPhases = Object.entries(pkg.manifest.scripts ?? {})
      .filter(([, command]) => typeof command === 'string' && /sync-package-skills\.mjs|skills[\\/]scripts[\\/]distribution\.mjs/u.test(command))
      .map(([phase]) => phase)
    const tsdownConfig = await fs.readFile(path.join(pkg.directory, 'tsdown.config.ts'), 'utf8')
      .catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error))
    if (/syncPackageSkills|sync-package-skills\.mjs|skills[\\/]scripts[\\/]distribution\.mjs/u.test(tsdownConfig)) {
      generationPhases.push('tsdown.config.ts')
    }
    if (generationPhases.length > 0) {
      issues.push(`${pkg.directory}: package skills must not be generated by ${generationPhases.join(', ')}`)
    }
    if (turbo.tasks[`${pkg.name}#build`]) {
      issues.push(`${pkg.name}: package-local skills must use the default build inputs without a dedicated task`)
    }
    for (const name of pkg.skills) {
      if (!guide.includes(name)) {
        issues.push(`${CONSUMER_GUIDE}: missing package skill ${name}`)
      }
      const source = sources.find(item => item.name === name && item.owner === pkg.name)
      if (!source) {
        issues.push(`${pkg.directory}: missing discovered source for ${name}`)
        continue
      }
      await validateSkillReferences(source, issues)
    }
  }

  const templates = JSON.parse(await fs.readFile('packages/create-weapp-vite/src/templateDefinitions.json', 'utf8'))
  const { generatedAgentGuidelines } = await import('../../packages/create-weapp-vite/src/generated/agents.ts')
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
    for (const name of names) {
      if (guidance.includes(`$${name}`) !== selected.includes(name)) {
        issues.push(`${template.id}: template guidance differs from selected skills: ${name}`)
      }
    }
  }
  return packageConfigs
}

async function validateMaintenanceContracts(packageConfigs, sources, issues) {
  const caseIssues = validateCaseCatalog(skillCases, packageConfigs)
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
  const packageSources = sources.filter(source => source.owner)
  const digests = Object.fromEntries(await Promise.all(packageSources.map(async source => [source.name, await hashSkillTree(path.resolve(source.directory))])))
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
  const sources = await discoverPublicSkillSources()
  const packageSkills = await discoverPackageSkills()
  const names = sources.map(source => source.name)
  const issues = []

  if (names.length === 0) {
    throw new Error('No public skills found')
  }

  await Promise.all(sources.map(source => validateSkill(source, issues)))
  await validateScoringMap(names, issues)
  const packageConfigs = await validateDistribution(sources, packageSkills, issues)
  const evidence = await validateMaintenanceContracts(packageConfigs, sources, issues)

  if (issues.length > 0) {
    console.error('[public-skills] contract validation failed:')
    for (const issue of issues.sort()) {
      console.error(`- ${issue}`)
    }
    process.exitCode = 1
    return
  }

  console.log(`[public-skills] validated ${names.length} public skills, ${packageSkills.length} package owners and scoped template contracts`)
  console.log(`[skill-cases] checked ${skillCases.cases.length} candidate/approved case contracts; no task executed`)
  if (evidence) {
    console.log(`[skill-evidence] record consistency only, not evidence authenticity: ${JSON.stringify(evidence)}`)
    process.exitCode = evidence.failed ? 1 : evidence.unverified ? 2 : 0
  }
}

await main()
