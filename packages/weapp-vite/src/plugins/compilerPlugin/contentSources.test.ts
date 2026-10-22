import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createTailwindV4SourceEntryMatcher } from '@weapp-tailwindcss/engine'
import { expect, it } from 'vitest'
import { createCompilerContentSourceOwner, ownsCompilerContentSource } from './contentSources'

async function withScope(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'compiler-content-scope-'))
  try {
    await run(root)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}

it('admits existing, new and deleted compiler-only sources using the upstream positive and negative scope', async () => {
  await withScope(async (root) => {
    const content = path.join(root, 'content')
    const config = { outDir: path.join(content, 'output') }
    const owner = createCompilerContentSourceOwner(config)
    owner.replace('app.css', createTailwindV4SourceEntryMatcher([
      { base: content, pattern: '**/*.ts', negated: false },
      { base: content, pattern: 'ignored/**', negated: true },
    ]))
    const existing = path.join(content, 'shared.ts')
    await mkdir(content)
    await writeFile(existing, 'export const utility = "h-[19px]"')
    expect(ownsCompilerContentSource(config, existing)).toBe(true)
    expect(ownsCompilerContentSource(config, path.join(content, 'new.ts'))).toBe(true)
    await rm(existing)
    expect(ownsCompilerContentSource(config, existing)).toBe(true)
    expect(ownsCompilerContentSource(config, path.join(content, 'ignored/shared.ts'))).toBe(false)
    expect(ownsCompilerContentSource(config, path.join(content, 'output/generated.ts'))).toBe(false)
    expect(ownsCompilerContentSource(config, path.join(root, 'outside.ts'))).toBe(false)
    expect(ownsCompilerContentSource(config, path.join(content, 'outside.vue'))).toBe(false)
    owner.dispose()
    expect(ownsCompilerContentSource(config, existing)).toBe(false)
  })
})

it('replaces a root scope, including source(none), without letting stale cleanup remove its replacement', async () => {
  await withScope(async (root) => {
    const config = { outDir: path.join(root, 'dist') }
    const oldOwner = createCompilerContentSourceOwner(config)
    const replacement = createCompilerContentSourceOwner(config)
    const first = path.join(root, 'first.ts')
    const second = path.join(root, 'second.ts')
    oldOwner.replace('app.css', createTailwindV4SourceEntryMatcher([{ base: root, pattern: 'first.ts', negated: false }]))
    expect(ownsCompilerContentSource(config, first)).toBe(true)
    replacement.replace('app.css', createTailwindV4SourceEntryMatcher([{ base: root, pattern: 'second.ts', negated: false }]))
    oldOwner.remove('app.css')
    oldOwner.dispose()
    oldOwner.dispose()
    expect(ownsCompilerContentSource(config, first)).toBe(false)
    expect(ownsCompilerContentSource(config, second)).toBe(true)
    replacement.replace('app.css', createTailwindV4SourceEntryMatcher([]))
    expect(ownsCompilerContentSource(config, second)).toBe(false)
    replacement.remove('app.css')
    replacement.remove('app.css')
    replacement.dispose()
  })
})

it('keeps shared source ownership until every CSS root is released and isolates projects', async () => {
  await withScope(async (root) => {
    const config = { outDir: path.join(root, 'dist') }
    const otherConfig = { outDir: path.join(root, 'other-dist') }
    const first = createCompilerContentSourceOwner(config)
    const second = createCompilerContentSourceOwner(config)
    const otherProject = createCompilerContentSourceOwner(otherConfig)
    const shared = path.join(root, 'shared.ts')
    const matcher = createTailwindV4SourceEntryMatcher([{ base: root, pattern: 'shared.ts', negated: false }])
    first.replace('first.css', matcher)
    second.replace('second.css', matcher)
    otherProject.replace('first.css', matcher)
    first.dispose()
    expect(ownsCompilerContentSource(config, shared)).toBe(true)
    second.remove('second.css')
    expect(ownsCompilerContentSource(config, shared)).toBe(false)
    expect(ownsCompilerContentSource(otherConfig, shared)).toBe(true)
    second.dispose()
    otherProject.dispose()
    expect(ownsCompilerContentSource(otherConfig, shared)).toBe(false)
  })
})

it('releases configuration-restart ownership and prevents a disposed generation from returning', async () => {
  await withScope(async (root) => {
    const config = { outDir: path.join(root, 'dist') }
    const source = path.join(root, 'shared.ts')
    const matcher = createTailwindV4SourceEntryMatcher([{ base: root, pattern: 'shared.ts', negated: false }])
    const previous = createCompilerContentSourceOwner(config)
    previous.replace('app.css', matcher)
    previous.dispose()
    const restarted = createCompilerContentSourceOwner(config)
    restarted.replace('app.css', undefined)
    previous.replace('app.css', matcher)
    expect(ownsCompilerContentSource(config, source)).toBe(false)
    restarted.replace('app.css', matcher)
    expect(ownsCompilerContentSource(config, source)).toBe(true)
    config.outDir = root
    expect(ownsCompilerContentSource(config, source)).toBe(false)
    restarted.dispose()
  })
})

it.each(['delete', 'replacement', 'closed'] as const)('rejects an asynchronous source-scope commit after root %s', async (event) => {
  await withScope(async (root) => {
    const config = { outDir: path.join(root, 'dist') }
    const owner = createCompilerContentSourceOwner(config)
    const first = path.join(root, 'first.ts')
    const second = path.join(root, 'second.ts')
    const firstMatcher = createTailwindV4SourceEntryMatcher([{ base: root, pattern: 'first.ts', negated: false }])
    const secondMatcher = createTailwindV4SourceEntryMatcher([{ base: root, pattern: 'second.ts', negated: false }])
    owner.replace('app.css', firstMatcher)
    const generation = owner.begin('app.css')
    const pendingMatcher = Promise.withResolvers<typeof firstMatcher>()
    let committed = false
    const lateGeneration = pendingMatcher.promise.then((matches) => {
      committed = owner.isCurrent('app.css', generation)
      owner.replace('app.css', matches, generation)
    })
    expect(ownsCompilerContentSource(config, first)).toBe(true)
    if (event === 'delete') {
      owner.remove('app.css')
    }
    else if (event === 'replacement') {
      owner.replace('app.css', secondMatcher)
    }
    else {
      owner.dispose()
    }
    pendingMatcher.resolve(firstMatcher)
    await lateGeneration
    expect(committed).toBe(false)
    expect(ownsCompilerContentSource(config, first)).toBe(false)
    expect(ownsCompilerContentSource(config, second)).toBe(event === 'replacement')
    owner.dispose()
  })
})
