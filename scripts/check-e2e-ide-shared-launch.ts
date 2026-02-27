import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { parse } from '@babel/parser'
import traverseModule from '@babel/traverse'
import fg from 'fast-glob'

const REPO_ROOT = process.cwd()
const IDE_TEST_GLOB = 'e2e/ide/**/*.test.ts'
const traverse = (traverseModule as any).default ?? traverseModule

interface Violation {
  file: string
  message: string
}

function normalizePath(filePath: string) {
  return path.relative(REPO_ROOT, filePath).replaceAll(path.sep, '/')
}

function isItOrTestCallee(callee: any) {
  return callee?.type === 'Identifier' && (callee.name === 'it' || callee.name === 'test')
}

function isInsideItOrTestCallback(pathLike: any) {
  let current = pathLike.parentPath
  while (current) {
    if (typeof current.isFunction === 'function' && current.isFunction()) {
      const parent = current.parentPath
      if (
        parent
        && typeof parent.isCallExpression === 'function'
        && parent.isCallExpression()
        && isItOrTestCallee(parent.node.callee)
      ) {
        return true
      }
    }
    current = current.parentPath
  }
  return false
}

async function checkFile(filePath: string) {
  const code = await fs.readFile(filePath, 'utf8')
  if (!code.includes('launchAutomator(')) {
    return [] as Violation[]
  }

  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['typescript'],
  })

  const launchCallLines: number[] = []
  const violations: Violation[] = []
  const relativePath = normalizePath(filePath)

  traverse(ast, {
    CallExpression(callPath) {
      if (callPath.node.callee.type !== 'Identifier' || callPath.node.callee.name !== 'launchAutomator') {
        return
      }

      const line = callPath.node.loc?.start.line ?? 0
      launchCallLines.push(line)

      if (isInsideItOrTestCallback(callPath)) {
        violations.push({
          file: relativePath,
          message: `line ${line}: launchAutomator must not be called inside it/test callbacks; use shared session helper instead`,
        })
      }
    },
  })

  if (launchCallLines.length > 1) {
    violations.push({
      file: relativePath,
      message: `found ${launchCallLines.length} launchAutomator call sites (${launchCallLines.join(', ')}); keep one shared launch per file/app`,
    })
  }

  return violations
}

async function main() {
  const files = await fg(IDE_TEST_GLOB, {
    cwd: REPO_ROOT,
    absolute: true,
    onlyFiles: true,
  })

  const violations = (await Promise.all(files.map(checkFile))).flat()
  if (violations.length === 0) {
    console.info(`[check:e2e-ide-shared-launch] OK (${files.length} files)`)
    return
  }

  console.error('[check:e2e-ide-shared-launch] violations found:')
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.message}`)
  }
  process.exitCode = 1
}

void main()
