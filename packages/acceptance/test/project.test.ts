import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { configSchema, projectFingerprint } from '@weapp-agent/core'
import { afterEach, beforeEach, expect, it } from 'vitest'
import {
  defaultVerification,
  detectProject,
  projectInstructions,
  verifyProject,
} from '../src/index.js'

let root: string
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'weapp-project-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})
it.each(['native', 'wevu'])(
  'detects a %s project and scoped instructions',
  async (kind) => {
    await mkdir(path.join(root, 'src/pages'), { recursive: true })
    await writeFile(path.join(root, kind === 'wevu' ? 'src/pages/index.vue' : 'src/pages/index.wxml'), kind === 'wevu' ? '<template><view /></template>' : '<view />')
    await writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({
        packageManager: 'pnpm@12.6.0',
        dependencies: {
          'weapp-vite': '10.0.0',
          ...(kind === 'wevu' ? { wevu: '1' } : {}),
        },
        scripts: { build: 'wv build', test: 'vitest' },
      }),
    )
    await writeFile(
      path.join(root, 'src/app.json'),
      JSON.stringify({
        pages: ['pages/index/index'],
        subPackages: [{ root: 'features' }],
      }),
    )
    await writeFile(path.join(root, 'AGENTS.md'), 'Root instruction')
    await writeFile(
      path.join(root, 'src/pages/AGENTS.md'),
      'Scoped page instruction',
    )
    const project = await detectProject(root)
    expect(project.kind).toBe(kind)
    expect(project.pages).toEqual(['pages/index/index'])
    expect(project.subPackages).toEqual(['features'])
    expect(defaultVerification(project).map(c => c.kind)).toEqual([
      'build',
      'test',
    ])
    expect(await projectInstructions(project)).toContain(
      'Scoped page instruction',
    )
  },
)
it('reports real exits and missing categories separately', async () => {
  const config = configSchema.parse({
    model: { provider: 'openai', name: 'test' },
    verification: [
      {
        kind: 'build',
        command: process.execPath,
        args: ['-e', 'console.log("built")'],
      },
      {
        kind: 'test',
        command: process.execPath,
        args: ['-e', 'process.exit(1)'],
      },
    ],
  })
  const report = await verifyProject(
    config,
    {
      root,
      trusted: true,
      signal: new AbortController().signal,
      approve: async () => false,
    },
    await projectFingerprint(root, config),
  )
  expect(report.passed).toBe(false)
  expect(report.checks.map(c => `${c.kind}:${c.status}`)).toEqual([
    'build:passed',
    'test:failed',
    'typecheck:unverified',
    'devtools:unverified',
  ])
})
it('does not run changed scripts under old authorization', async () => {
  const config = configSchema.parse({
    model: { provider: 'openai', name: 'test' },
    verification: [
      {
        kind: 'build',
        command: process.execPath,
        args: ['-e', 'process.exit(0)'],
      },
    ],
  })
  const before = await projectFingerprint(root, config)
  await writeFile(
    path.join(root, 'package.json'),
    '{"scripts":{"build":"changed"}}',
  )
  await expect(
    verifyProject(
      config,
      {
        root,
        trusted: true,
        signal: new AbortController().signal,
        approve: async () => false,
      },
      before,
    ),
  ).rejects.toThrow('Approval required')
})
it('labels an entirely unconfigured verification as incomplete', async () => {
  const config = configSchema.parse({
    model: { provider: 'openai', name: 'test' },
  })
  const report = await verifyProject(
    config,
    {
      root,
      trusted: true,
      signal: new AbortController().signal,
      approve: async () => false,
    },
    await projectFingerprint(root, config),
  )
  expect(report.passed).toBe(false)
  expect(report.checks.every(c => c.status === 'unverified')).toBe(true)
})
