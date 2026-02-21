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

function readProjectSkillNames() {
  if (!fs.existsSync(projectSkillsDir)) {
    return []
  }

  return fs.readdirSync(projectSkillsDir, { withFileTypes: true })
    .filter(item => item.isDirectory())
    .map(item => item.name)
    .filter(name => fs.existsSync(path.join(projectSkillsDir, name, 'SKILL.md')))
    .sort()
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

const skillNames = readProjectSkillNames()

if (skillNames.length === 0) {
  console.log(`No project skills found in ${projectSkillsDir}`)
  process.exit(0)
}

console.log(`Linking ${skillNames.length} project skills from ${projectSkillsDir}`)

ensureDir(agentsSkillsDir)
ensureDir(codexSkillsDir)
ensureDir(claudeSkillsDir)

for (const skillName of skillNames) {
  const sourceSkillPath = path.join(projectSkillsDir, skillName)
  const agentsLinkPath = path.join(agentsSkillsDir, skillName)
  linkSafely(agentsLinkPath, sourceSkillPath)

  const codexLinkPath = path.join(codexSkillsDir, skillName)
  const codexTarget = toRelativeTarget(codexSkillsDir, agentsLinkPath)
  linkSafely(codexLinkPath, codexTarget)

  const claudeLinkPath = path.join(claudeSkillsDir, skillName)
  const claudeTarget = toRelativeTarget(claudeSkillsDir, agentsLinkPath)
  linkSafely(claudeLinkPath, claudeTarget)
}

console.log('Done.')
