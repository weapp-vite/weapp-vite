import fs from 'node:fs'
import path from 'node:path'

const ignoredDirectoryNames = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  '.cache',
  '.codex-tmp',
  '.minidev',
  '.playwright',
  '.playwright-cli',
  '.pnpm-store',
  '.tmp',
  '.turbo',
  '.weapp-vite',
  '.wevu-config',
])

const generatedDirectories = new Set([
  'docs/reports',
  'packages/create-weapp-vite/templates',
])

export function discoverAgentFiles(root: string) {
  const files: string[] = []

  function visit(directory: string) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name)
      const relativePath = path.relative(root, fullPath).split(path.sep).join('/')
      if (ignoredDirectoryNames.has(entry.name) || generatedDirectories.has(relativePath)) {
        continue
      }
      if (entry.isDirectory()) {
        visit(fullPath)
      }
      else if (entry.name === 'AGENTS.md') {
        files.push(relativePath)
      }
    }
  }

  visit(root)
  return files.sort()
}
