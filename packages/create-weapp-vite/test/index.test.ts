import type { TemplateName } from '@weapp-core/init'
import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// shared answers object for mocked prompts
const answers: {
  name: string
  overwrite?: boolean
  template?: TemplateName
} = {
  name: 'my-app',
}

// Mock inquirer prompts to make CLI non-interactive in tests
vi.mock('@inquirer/prompts', () => {
  return {
    input: async () => answers.name,
    confirm: async () => answers.overwrite ?? false,
    select: async () => (answers.template ?? 'default'), // TemplateName.default
  }
})

async function waitForFile(file: string, timeoutMs = 20_000) {
  const start = Date.now()
  for (;;) {
    if (await fs.pathExists(file)) {
      return
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timeout waiting for ${file}`)
    }
    await new Promise(r => setTimeout(r, 50))
  }
}

async function listAll(root: string) {
  const out: string[] = []
  async function walk(dir: string, base = '') {
    const entries = await fs.readdir(dir)
    for (const e of entries) {
      const full = path.join(dir, e)
      const rel = path.join(base, e)
      const stat = await fs.stat(full)
      if (stat.isDirectory()) {
        await walk(full, rel)
      }
      else {
        out.push(rel)
      }
    }
  }
  if (await fs.pathExists(root)) {
    await walk(root)
  }
  return out.sort()
}

const tmpRoot = path.join(os.tmpdir(), 'weapp-vite-create-cli-tests')

beforeEach(async () => {
  await fs.remove(tmpRoot)
  await fs.ensureDir(tmpRoot)
})

afterEach(async () => {
  // keep artifacts for debugging if needed; comment next line to inspect
  await fs.remove(tmpRoot)
  vi.resetModules()
})

describe('create-weapp-vite CLI (mocked prompts)', () => {
  it('pnpm create weapp-vite@latest equivalent flow (default template)', async () => {
    const name = 'cli-pnpm'
    const cwd = path.join(tmpRoot, 'pnpm')
    await fs.ensureDir(cwd)
    process.chdir(cwd)
    answers.name = name
    answers.template = 'default' as unknown as TemplateName // default

    // import triggers run() due to side-effect at module load
    await import('../src/cli')

    // assert output generated
    const out = path.join(cwd, name)
    await waitForFile(path.join(out, 'package.json'))
    const hasProjectConfig = await fs.pathExists(path.join(out, 'project.config.json'))
    if (!hasProjectConfig) {
      // debug aid
      // eslint-disable-next-line no-console
      console.log('project files:', await listAll(out))
    }
    expect(hasProjectConfig).toBe(true)
  })

  it('yarn create weapp-vite@latest equivalent flow (tailwindcss template)', async () => {
    const name = 'cli-yarn'
    const cwd = path.join(tmpRoot, 'yarn')
    await fs.ensureDir(cwd)
    process.chdir(cwd)
    answers.name = name
    // tailwindcss template
    answers.template = 'tailwindcss' as unknown as TemplateName

    await import('../src/cli')

    const out = path.join(cwd, name)
    await waitForFile(path.join(out, 'package.json'))
    // check a tailwind related file exists
    const hasTailwind = await fs.pathExists(path.join(out, 'tailwind.config.ts'))
    expect(hasTailwind).toBe(true)
  })

  it('npm create weapp-vite@latest equivalent flow (abort on existing dir)', async () => {
    const name = 'cli-npm'
    const cwd = path.join(tmpRoot, 'npm')
    const out = path.join(cwd, name)
    await fs.ensureDir(out)
    // sentinel file
    await fs.outputFile(path.join(out, '.keep'), '')
    process.chdir(cwd)
    answers.name = name
    // directory exists, choose not to overwrite
    answers.overwrite = false
    answers.template = 0 as unknown as TemplateName

    await import('../src/cli')

    // Not overwritten; sentinel stays and package.json should not be generated
    expect(await fs.pathExists(path.join(out, '.keep'))).toBe(true)
    expect(await fs.pathExists(path.join(out, 'package.json'))).toBe(false)
  })
})
