import type { StatefulHmrOutputFile } from './outputWriter'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { expect, it } from 'vitest'
import { StatefulHmrOutputPublication } from './outputPublication'
import { createViteDevEngine } from './viteDevEngine'

it('separates lazy additional emission from a complete native rebuild with the watcher disabled', async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'native-publication-')))
  const main = path.join(root, 'main.js')
  const lazy = path.join(root, 'lazy.js')
  await writeFile(main, 'export const open = () => import("./lazy.js")')
  await writeFile(lazy, 'export const label = "lazy-source"')
  const events: Array<{ source: string, files: string[] }> = []
  const publication = new StatefulHmrOutputPublication()
  let lazyId = ''
  let buildCount = 0
  let nextBuildGate: { entered: () => void, release: Promise<void> } | undefined
  const errors: Error[] = []
  const publish = (source: 'full' | 'additional', output: StatefulHmrOutputFile[]) => {
    void publication.publish(source, () => {
      events.push({ source, files: output.map(item => item.fileName) })
    })
  }
  const engine = await createViteDevEngine({
    input: main,
    experimental: { devMode: { lazy: true } },
    plugins: [{
      name: 'native-output-publication-contract',
      async buildStart() {
        buildCount += 1
        const gate = nextBuildGate
        nextBuildGate = undefined
        if (gate) {
          gate.entered()
          await gate.release
        }
      },
      moduleParsed(info) {
        lazyId = info.dynamicallyImportedIds[0] ?? lazyId
      },
      async load(id) {
        if (id.replaceAll('\\', '/') === lazy) {
          this.emitFile({ type: 'asset', fileName: 'lazy.wxss', source: '.lazy {}' })
          return await readFile(lazy, 'utf8')
        }
      },
    }],
  }, { entryFileNames: 'app.js' }, {
    watch: { enabled: false, skipWrite: true },
    onOutput(result) {
      if (result instanceof Error) {
        errors.push(result)
      }
      else {
        publish('full', result.output as StatefulHmrOutputFile[])
      }
    },
    onAdditionalAssets(result) { publish('additional', result.output as StatefulHmrOutputFile[]) },
  })
  try {
    await engine.run()
    await engine.ensureCurrentBuildFinish()
    await engine.registerClient('publication-contract')
    expect(errors).toEqual([])
    expect(events.at(-1)).toMatchObject({ source: 'full', files: expect.arrayContaining(['app.js']) })
    await engine.compileEntry(lazyId, 'publication-contract')
    expect(events).toContainEqual({ source: 'additional', files: expect.arrayContaining(['lazy.wxss']) })
    const priorBuildCount = buildCount
    const priorEventCount = events.length
    await publication.rebuild(engine, 5000)
    expect(buildCount).toBeGreaterThan(priorBuildCount)
    expect(events.slice(priorEventCount)).toContainEqual({ source: 'full', files: expect.arrayContaining(['app.js']) })
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    nextBuildGate = { entered: entered.resolve, release: release.promise }
    const beforeConcurrentBuild = buildCount
    engine.triggerFullBuild()
    const current = engine.ensureLatestBuildOutput()
    await entered.promise
    const requested = publication.rebuild(engine, 5000)
    release.resolve()
    await Promise.all([current, requested])
    expect(buildCount).toBe(beforeConcurrentBuild + 2)
    expect(errors).toEqual([])
  }
  finally {
    await engine.close()
    await rm(root, { recursive: true, force: true })
  }
})
