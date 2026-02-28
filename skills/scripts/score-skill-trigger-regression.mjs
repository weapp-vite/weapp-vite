#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const DEFAULT_FILE = 'skills/skill-trigger-regression-checklist.md'

const EXPECTED_BY_ID = {
  A1: 'weapp-vite-best-practices',
  A2: 'weapp-vite-best-practices',
  A3: 'weapp-vite-best-practices',
  A4: 'weapp-vite-best-practices',
  A5: 'weapp-vite-vue-sfc-best-practices',
  B1: 'weapp-vite-vue-sfc-best-practices',
  B2: 'weapp-vite-vue-sfc-best-practices',
  B3: 'weapp-vite-vue-sfc-best-practices',
  B4: 'weapp-vite-vue-sfc-best-practices',
  B5: 'weapp-vite-best-practices',
  C1: 'wevu-best-practices',
  C2: 'wevu-best-practices',
  C3: 'wevu-best-practices',
  C4: 'wevu-best-practices',
  C5: 'weapp-vite-vue-sfc-best-practices',
  D1: 'native-to-weapp-vite-wevu-migration',
  D2: 'native-to-weapp-vite-wevu-migration',
  D3: 'native-to-weapp-vite-wevu-migration',
  D4: 'native-to-weapp-vite-wevu-migration',
  D5: 'weapp-vite-best-practices',
  E1: 'weapp-ide-cli-best-practices',
  E2: 'weapp-ide-cli-best-practices',
  E3: 'weapp-ide-cli-best-practices',
  E4: 'weapp-ide-cli-best-practices',
  E5: 'weapp-vite-best-practices',
  X1: 'weapp-vite-vue-sfc-best-practices',
  X2: 'native-to-weapp-vite-wevu-migration',
  X3: 'weapp-vite-vue-sfc-best-practices',
  X4: 'weapp-ide-cli-best-practices',
}

const MAIN_IDS = new Set([
  'A1',
  'A2',
  'A3',
  'A4',
  'B1',
  'B2',
  'B3',
  'B4',
  'C1',
  'C2',
  'C3',
  'C4',
  'D1',
  'D2',
  'D3',
  'D4',
  'E1',
  'E2',
  'E3',
  'E4',
])

const BOUNDARY_IDS = new Set(['A5', 'B5', 'C5', 'D5', 'E5'])
const CONFLICT_IDS = new Set(['X1', 'X2', 'X3', 'X4'])

const SKILL_BY_GROUP = {
  A: 'weapp-vite-best-practices',
  B: 'weapp-vite-vue-sfc-best-practices',
  C: 'wevu-best-practices',
  D: 'native-to-weapp-vite-wevu-migration',
  E: 'weapp-ide-cli-best-practices',
}

function parseArgs(argv) {
  const options = {
    file: DEFAULT_FILE,
    json: false,
  }

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--json') {
      options.json = true
      continue
    }
    if (token === '--file') {
      options.file = argv[i + 1] ?? DEFAULT_FILE
      i += 1
      continue
    }
    if (token === '-h' || token === '--help') {
      printHelp()
      process.exit(0)
    }
  }

  return options
}

function printHelp() {
  console.log('Usage:')
  console.log('  node skills/scripts/score-skill-trigger-regression.mjs [--file <path>] [--json]')
  console.log('')
  console.log('Options:')
  console.log('  --file   Markdown checklist file path')
  console.log('  --json   Print JSON report')
}

function normalizeSkill(raw) {
  if (!raw) {
    return ''
  }
  return raw
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function toPercent(part, total) {
  if (!total) {
    return '0.0%'
  }
  return `${((part / total) * 100).toFixed(1)}%`
}

function formatGate(value) {
  if (value === null) {
    return 'N/A'
  }
  return value ? 'PASS' : 'FAIL'
}

function parseTableRows(markdownText) {
  const rows = []
  const lines = markdownText.split('\n')

  for (const line of lines) {
    if (!line.startsWith('|')) {
      continue
    }
    const parts = line.split('|').map(item => item.trim())
    if (parts.length < 8) {
      continue
    }

    const id = parts[1]
    if (!/^[A-EX]\d+$/.test(id)) {
      continue
    }

    rows.push({
      id,
      question: parts[2],
      expected: parts[3],
      actual: parts[4],
      result: parts[5],
      note: parts[6],
    })
  }

  return rows
}

function calc(rows) {
  const evaluated = []

  for (const row of rows) {
    const expectedSkill = normalizeSkill(row.expected) || EXPECTED_BY_ID[row.id]
    const actualSkill = normalizeSkill(row.actual)
    const hasActual = Boolean(actualSkill)
    const pass = hasActual && expectedSkill === actualSkill
    evaluated.push({
      ...row,
      expectedSkill,
      actualSkill,
      hasActual,
      pass,
    })
  }

  const filledRows = evaluated.filter(item => item.hasActual)
  const totalPass = filledRows.filter(item => item.pass).length

  const perSkill = Object.entries(SKILL_BY_GROUP).map(([group, skill]) => {
    const ids = [...MAIN_IDS].filter(id => id.startsWith(group))
    const items = evaluated.filter(item => ids.includes(item.id))
    const filled = items.filter(item => item.hasActual)
    const pass = filled.filter(item => item.pass).length
    return {
      group,
      skill,
      pass,
      filled: filled.length,
      rate: filled.length ? pass / filled.length : 0,
      passThreshold: filled.length ? pass >= 3 : null,
    }
  })

  const boundaryItems = evaluated.filter(item => BOUNDARY_IDS.has(item.id) && item.hasActual)
  const boundaryFailItems = boundaryItems.filter(item => !item.pass)
  const wrongSkillCounter = new Map()
  for (const item of boundaryFailItems) {
    const key = item.actualSkill || '(empty)'
    wrongSkillCounter.set(key, (wrongSkillCounter.get(key) ?? 0) + 1)
  }

  let boundaryViolation = false
  for (const [, count] of wrongSkillCounter.entries()) {
    if (count > 1) {
      boundaryViolation = true
      break
    }
  }

  const conflictItems = evaluated.filter(item => CONFLICT_IDS.has(item.id) && item.hasActual)
  const conflictPass = conflictItems.filter(item => item.pass).length
  const mainEvaluatedItems = perSkill.filter(item => item.filled > 0)

  const overall = {
    filledCount: filledRows.length,
    totalCount: evaluated.length,
    passCount: totalPass,
    passRate: filledRows.length ? totalPass / filledRows.length : 0,
  }

  const gate = {
    mainSkillRule: mainEvaluatedItems.length ? mainEvaluatedItems.every(item => item.passThreshold) : null,
    boundaryRule: boundaryItems.length ? !boundaryViolation : null,
    conflictRule: conflictItems.length ? conflictPass === conflictItems.length : null,
  }

  return {
    overall,
    perSkill,
    boundary: {
      filled: boundaryItems.length,
      fail: boundaryFailItems.length,
      wrongSkillCounter: Object.fromEntries(wrongSkillCounter.entries()),
      pass: boundaryItems.length ? !boundaryViolation : null,
    },
    conflict: {
      filled: conflictItems.length,
      pass: conflictPass,
      rate: conflictItems.length ? conflictPass / conflictItems.length : 0,
      allPass: conflictItems.length ? conflictPass === conflictItems.length : null,
    },
    gate,
    details: evaluated,
  }
}

function printHuman(report, filePath) {
  console.log(`Checklist: ${filePath}`)
  console.log('')

  console.log('Overall')
  console.log(`- Filled rows: ${report.overall.filledCount}/${report.overall.totalCount}`)
  console.log(`- Pass: ${report.overall.passCount}/${report.overall.filledCount} (${toPercent(report.overall.passCount, report.overall.filledCount)})`)
  console.log('')

  console.log('Main Skill Hit Rate (A1-4/B1-4/C1-4/D1-4/E1-4)')
  for (const item of report.perSkill) {
    console.log(`- ${item.skill}: ${item.pass}/${item.filled} (${toPercent(item.pass, item.filled)}) | rule(pass>=3): ${formatGate(item.passThreshold)}`)
  }
  console.log('')

  console.log('Boundary Rule (A5/B5/C5/D5/E5)')
  console.log(`- Boundary pass: ${formatGate(report.boundary.pass)}`)
  console.log(`- Wrong-skill distribution: ${JSON.stringify(report.boundary.wrongSkillCounter)}`)
  console.log('')

  console.log('Conflict Rule (X1/X2/X3/X4)')
  console.log(`- Conflict pass: ${report.conflict.pass}/${report.conflict.filled} (${toPercent(report.conflict.pass, report.conflict.filled)})`)
  console.log(`- All conflict cases pass: ${formatGate(report.conflict.allPass)}`)
  console.log('')

  console.log('Gate Summary')
  console.log(`- Main skill rule: ${formatGate(report.gate.mainSkillRule)}`)
  console.log(`- Boundary rule: ${formatGate(report.gate.boundaryRule)}`)
  console.log(`- Conflict rule: ${formatGate(report.gate.conflictRule)}`)
}

function main() {
  const options = parseArgs(process.argv)
  const absoluteFilePath = path.resolve(process.cwd(), options.file)
  const text = fs.readFileSync(absoluteFilePath, 'utf8')
  const rows = parseTableRows(text)
  const report = calc(rows)

  if (options.json) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  printHuman(report, absoluteFilePath)
}

main()
