#!/usr/bin/env node

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const dryRun = process.argv.includes('--dry-run')

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const projectSkillsDir = path.join(repoRoot, 'skills')
const projectClaudeSkillsDir = path.join(repoRoot, '.claude', 'skills')

const home = os.homedir()
const agentsSkillsDir = path.join(home, '.agents', 'skills')
const codexSkillsDir = path.join(home, '.codex', 'skills')
const claudeSkillsDir = path.join(home, '.claude', 'skills')

function ensureDir(dirPath) {
  if (dryRun) {
    console.log(`[dry-run] mkdir -p ${dirPath}`)
    return
  }
  fs.mkdirSync(dirPath, { recursive: true })
}

function readSkillNamesFrom(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return []
  }

  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter(item => item.isDirectory())
    .map(item => item.name)
    .filter(name => fs.existsSync(path.join(dirPath, name, 'SKILL.md')))
    .sort()
}

function collectProjectSkills() {
  const sources = [
    {
      source: 'skills',
      dir: projectSkillsDir,
      names: readSkillNamesFrom(projectSkillsDir),
    },
    {
      source: '.claude/skills',
      dir: projectClaudeSkillsDir,
      names: readSkillNamesFrom(projectClaudeSkillsDir),
    },
  ]

  /** @type {Array<{ name: string, source: string, path: string }>} */
  const skills = []
  const seen = new Set()

  for (const source of sources) {
    for (const name of source.names) {
      if (seen.has(name)) {
        console.log(`[skip] duplicate skill name "${name}" in ${source.source}`)
        continue
      }

      seen.add(name)
      skills.push({
        name,
        source: source.source,
        path: path.join(source.dir, name),
      })
    }
  }

  return skills
}

function asResolved(linkPath, targetPath) {
  return path.resolve(path.dirname(linkPath), targetPath)
}

function isSameTarget(linkPath, currentTarget, nextTarget) {
  if (currentTarget === nextTarget) {
    return true
  }
  return asResolved(linkPath, currentTarget) === asResolved(linkPath, nextTarget)
}

function linkSafely(linkPath, targetPath) {
  const existing = fs.existsSync(linkPath) ? fs.lstatSync(linkPath) : null

  if (existing && !existing.isSymbolicLink()) {
    console.log(`[skip] ${linkPath} exists and is not a symlink`)
    return
  }

  if (existing?.isSymbolicLink()) {
    const currentTarget = fs.readlinkSync(linkPath)
    if (isSameTarget(linkPath, currentTarget, targetPath)) {
      console.log(`[ok] ${linkPath} -> ${targetPath}`)
      return
    }

    if (dryRun) {
      console.log(`[dry-run] rm ${linkPath}`)
    }
    else {
      fs.unlinkSync(linkPath)
    }
  }

  if (dryRun) {
    console.log(`[dry-run] ln -s ${targetPath} ${linkPath}`)
    return
  }

  fs.symlinkSync(targetPath, linkPath)
  console.log(`[link] ${linkPath} -> ${targetPath}`)
}

function toRelativeTarget(baseDir, targetPath) {
  const rel = path.relative(baseDir, targetPath)
  return rel || '.'
}

const skills = collectProjectSkills()

if (skills.length === 0) {
  console.log(`No project skills found in ${projectSkillsDir} or ${projectClaudeSkillsDir}`)
  process.exit(0)
}

console.log(`Linking ${skills.length} project skills from repo skill sources`)

ensureDir(agentsSkillsDir)
ensureDir(codexSkillsDir)
ensureDir(claudeSkillsDir)

for (const skill of skills) {
  const agentsLinkPath = path.join(agentsSkillsDir, skill.name)
  console.log(`[source] ${skill.name} <- ${skill.source}`)
  linkSafely(agentsLinkPath, skill.path)

  const codexLinkPath = path.join(codexSkillsDir, skill.name)
  const codexTarget = toRelativeTarget(codexSkillsDir, agentsLinkPath)
  linkSafely(codexLinkPath, codexTarget)

  const claudeLinkPath = path.join(claudeSkillsDir, skill.name)
  const claudeTarget = toRelativeTarget(claudeSkillsDir, agentsLinkPath)
  linkSafely(claudeLinkPath, claudeTarget)
}

console.log('Done.')
