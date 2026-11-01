import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { runCommand } from '../createWeappViteSmoke/process.mjs'
import { verifyOxlintPublicTypes } from '../verify-oxlint-public-types.mjs'

const roots: string[] = []
const typescriptRoot = path.dirname(fileURLToPath(import.meta.resolve('typescript/package.json')))

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'oxlint-public-types-contract-'))
  roots.push(root)
  const names = ['@weapp-vite/oxlint', '@weapp-vite/eslint']
  const mapping: Record<string, string> = {}
  for (const name of names) {
    const file = path.join(root, `${name.split('/')[1]}.tgz`)
    await fs.writeFile(file, 'fixture metadata supplied at the test boundary')
    mapping[name] = file
  }
  return {
    root,
    env: { ...process.env, CREATE_WEAPP_VITE_DEPENDENCY_TARBALLS: JSON.stringify(mapping), OXLINT_PUBLIC_TYPES_REPORT_DIR: path.join(root, 'reports') },
    readManifest: (tarball: string) => ({ name: names.find(name => mapping[name] === tarball), version: '0.0.0' }),
  }
}

async function installTypeFixture(root: string, eslintTypes: boolean, reference = '') {
  const packageRoot = path.join(root, 'node_modules/@weapp-vite/oxlint')
  await fs.mkdir(packageRoot, { recursive: true })
  await fs.cp(typescriptRoot, path.join(root, 'node_modules/typescript'), { recursive: true, dereference: true })
  await fs.writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({ name: '@weapp-vite/oxlint', type: 'module', exports: { '.': './index.d.mts', './plugin': './plugin.d.mts' } }))
  await fs.writeFile(path.join(packageRoot, 'index.d.mts'), [
    'export declare const miniProgramRecommended: { jsPlugins: Array<{ name: string, specifier: string }> }',
    'export declare const wevuRecommended: typeof miniProgramRecommended',
    'export declare const reactRecommended: typeof miniProgramRecommended',
  ].join('\n'))
  await fs.writeFile(path.join(packageRoot, 'plugin.d.mts'), `${reference}
import type { Rule } from 'eslint'
declare const plugin: {
  meta: { name: string }
  rules: {
    'no-unsupported-runtime-api': Rule.RuleModule
    'no-implicit-runtime-polyfill': Rule.RuleModule
    'no-unsupported-api': Rule.RuleModule
    'no-risky-api': Rule.RuleModule
  }
}
export default plugin
`)
  if (eslintTypes) {
    const eslintTypesRoot = path.join(root, 'node_modules/@types/eslint')
    await fs.mkdir(eslintTypesRoot, { recursive: true })
    await fs.writeFile(path.join(eslintTypesRoot, 'package.json'), '{"name":"@types/eslint","types":"index.d.ts"}')
    await fs.writeFile(path.join(eslintTypesRoot, 'index.d.ts'), 'export namespace Rule { interface RuleModule { create(context: { report(): void }): Record<string, () => void> } }\n')
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

describe('Oxlint isolated public type consumer', () => {
  it.each([false, true])('compiles imported declarations with ESLint types installed=%s and always removes its consumer', async (eslintTypes) => {
    const input = await fixture()
    let consumerRoot = ''
    const result = await verifyOxlintPublicTypes(input.env, {
      readManifest: input.readManifest,
      execute: async (invocation: Parameters<typeof runCommand>[0]) => {
        if (invocation.label.endsWith('/install')) {
          consumerRoot = invocation.cwd
          await installTypeFixture(consumerRoot, eslintTypes)
          return { stdout: '', stderr: '' }
        }
        return runCommand(invocation)
      },
    })
    expect(result.report.status).toBe(eslintTypes ? 'passed' : 'failed')
    expect(result.report.complete).toBe(eslintTypes)
    expect(result.report.cleanup).toBe('passed')
    await expect(fs.stat(consumerRoot)).rejects.toMatchObject({ code: 'ENOENT' })
    if (!eslintTypes) {
      expect(result.report.error).toContain('TS2307')
      expect(result.report.error).toContain('eslint')
      expect(result.report.steps.at(-1)).toMatchObject({ stage: 'typecheck', status: 'failed', exitCode: 1 })
    }
  })

  it('rejects a declaration resolved outside the consumer even when TypeScript accepts it', async () => {
    const input = await fixture()
    const external = path.join(input.root, 'external.d.ts')
    await fs.writeFile(external, 'declare const externalTypeLeak: true\n')
    const result = await verifyOxlintPublicTypes(input.env, {
      readManifest: input.readManifest,
      execute: async (invocation: Parameters<typeof runCommand>[0]) => {
        if (invocation.label.endsWith('/install')) {
          await installTypeFixture(invocation.cwd, true, `/// <reference path="${external.replaceAll('\\', '/')}" />`)
          return { stdout: '', stderr: '' }
        }
        return runCommand(invocation)
      },
    })
    expect(result.report.status).toBe('failed')
    expect(result.report.complete).toBe(false)
    expect(result.report.error).toContain('outside the isolated consumer')
    expect(result.report.cleanup).toBe('passed')
  })
})
