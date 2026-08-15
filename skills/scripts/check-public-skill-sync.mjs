#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import YAML from 'yaml'

const SKILLS_ROOT = 'skills'
const FULL_CONTRACT_FILES = [
  'AGENTS.md',
  'CLAUDE.md',
  'packages/create-weapp-vite/src/agents.ts',
  'skills/scripts/score-skill-trigger-regression.mjs',
  'skills/skill-trigger-regression-checklist.md',
  'website/.vitepress/components/AiLearningPage.vue',
  'website/guide/ai-workflows.md',
  'website/guide/ai.md',
  'website/guide/skills.md',
]
const SCOPED_CONTRACTS = new Map([
  ['website/packages/create-weapp-vite.md', ['weapp-vite-react-best-practices']],
])
const CONTRACT_FILES = [...FULL_CONTRACT_FILES, ...SCOPED_CONTRACTS.keys()]
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---/
const MAIN_SKILL_CASES_REGEX = /const MAIN_SKILL_CASES = \{([\s\S]*?)\n\}/
const SCORING_SKILL_KEY_REGEX = /^\s{2}'([^']+)':/gm
const QUOTED_INTERFACE_REGEX = /^\s+(display_name|short_description|default_prompt):\s+(['"]).*\2$/gm
const SCORING_MAP_FILE = 'skills/scripts/score-skill-trigger-regression.mjs'
const NON_PUBLIC_SCORING_GROUPS = new Set(['recent-capability-routing'])

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

async function main() {
  const skills = await discoverPublicSkills()
  const issues = []

  if (skills.length === 0) {
    throw new Error('No public skills found')
  }

  await Promise.all(skills.map(name => validateSkill(name, issues)))
  await validateScoringMap(skills, issues)

  for (const file of CONTRACT_FILES) {
    const source = await fs.readFile(file, 'utf8')
    const requiredSkills = SCOPED_CONTRACTS.get(file) ?? skills
    for (const name of requiredSkills) {
      if (!source.includes(name)) {
        issues.push(`${file}: missing public skill ${name}`)
      }
    }
  }

  if (issues.length > 0) {
    console.error('[public-skills] contract validation failed:')
    for (const issue of issues.sort()) {
      console.error(`- ${issue}`)
    }
    process.exitCode = 1
    return
  }

  console.log(`[public-skills] validated ${skills.length} public skill(s) across ${CONTRACT_FILES.length} contract file(s)`)
}

await main()
