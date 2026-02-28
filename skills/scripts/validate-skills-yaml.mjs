#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import fg from 'fast-glob'
import YAML from 'yaml'

const SKILLS_YAML_GLOB = 'skills/**/*.{yaml,yml}'

function toRelative(filePath) {
  return path.relative(process.cwd(), filePath)
}

function formatYamlError(error, filePath) {
  const location = Array.isArray(error.linePos) && error.linePos.length > 0
    ? `:${error.linePos[0].line}:${error.linePos[0].col}`
    : ''
  const message = error.message?.trim() || 'Unknown YAML parse error'
  return `${toRelative(filePath)}${location} ${message}`
}

async function resolveTargetFiles(argv) {
  if (argv.length > 0) {
    return argv
      .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'))
      .filter(file => file.startsWith('skills/'))
  }

  return fg(SKILLS_YAML_GLOB, {
    cwd: process.cwd(),
    absolute: false,
    onlyFiles: true,
  })
}

async function validateYamlFile(filePath) {
  const source = await fs.readFile(filePath, 'utf8')
  const doc = YAML.parseDocument(source, { prettyErrors: false })
  const issues = [...doc.errors, ...doc.warnings]
  if (issues.length === 0) {
    return []
  }
  return issues.map(issue => formatYamlError(issue, filePath))
}

async function main() {
  const files = await resolveTargetFiles(process.argv.slice(2))

  if (files.length === 0) {
    console.log('[skills-yaml] no target yaml files')
    return
  }

  const errors = []
  for (const file of files) {
    const fileErrors = await validateYamlFile(file)
    errors.push(...fileErrors)
  }

  if (errors.length > 0) {
    console.error('[skills-yaml] syntax validation failed:')
    for (const error of errors) {
      console.error(`- ${error}`)
    }
    process.exit(1)
  }

  console.log(`[skills-yaml] validated ${files.length} file(s)`)
}

main().catch((error) => {
  console.error('[skills-yaml] unexpected error')
  console.error(error)
  process.exit(1)
})
