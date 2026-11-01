import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { discoverAgentFiles } from './discover'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

function fixture(files: string[]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-discovery-'))
  roots.push(root)
  for (const file of files) {
    const target = path.join(root, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, '# Fixture\n')
  }
  return root
}

describe('agent document discovery', () => {
  it('excludes generated scaffold assets while keeping template sources and similar paths', () => {
    const root = fixture([
      'AGENTS.md',
      'templates/weapp-vite-template/AGENTS.md',
      'packages/create-weapp-vite/AGENTS.md',
      'packages/create-weapp-vite/templates/default/AGENTS.md',
      'packages/create-weapp-vite/templates/vite-plus/default/AGENTS.md',
      'packages/create-weapp-vite/templates-custom/AGENTS.md',
      'docs/reports/runtime/AGENTS.md',
      'docs/reports-custom/AGENTS.md',
    ])

    expect(discoverAgentFiles(root)).toEqual([
      'AGENTS.md',
      'docs/reports-custom/AGENTS.md',
      'packages/create-weapp-vite/AGENTS.md',
      'packages/create-weapp-vite/templates-custom/AGENTS.md',
      'templates/weapp-vite-template/AGENTS.md',
    ])
  })

  it('keeps unknown source documents discoverable and skips dependency and build directories', () => {
    const root = fixture([
      'apps/new-app/AGENTS.md',
      'apps/new-app/node_modules/dependency/AGENTS.md',
      'packages/new-package/dist/AGENTS.md',
      '.tmp/generated/AGENTS.md',
      '.git/worktrees/AGENTS.md',
    ])

    expect(discoverAgentFiles(root)).toEqual(['apps/new-app/AGENTS.md'])
  })
})
