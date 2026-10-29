import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { renameAtomicFile } from '../utils/hmrAtomicRename'
import { createNativeBatchProject, NATIVE_BATCH_CLI, NATIVE_BATCH_EXTENSIONS } from '../utils/nativeBatchProject'

describe('production snapshot sidecar HMR', () => {
  it('publishes sidecar saves and recovers retained outputs after a referenced template disappears', async (context) => {
    const project = await createNativeBatchProject('classic')
    let dev: ReturnType<typeof startDevProcess> | undefined
    let stage = 'fixture'
    context.onTestFailed(() => {
      process.stdout.write(`[snapshot-sidecar-failure] ${JSON.stringify({ stage })}\n`)
      process.stdout.write(dev?.getOutput().slice(-16_000) ?? '')
    })
    const source = path.join(project, 'src/sitemap.json')
    const card = path.join(project, 'src/shared/card.wxml')
    const json = (marker: string) => JSON.stringify({ desc: marker, rules: [] })
    const template = (marker: string) => `<template name="watcherCard"><view>${marker}</view></template>`
    const read = (file: string) => readFile(path.join(project, 'dist', file), 'utf8')
    const pageOutputs = async () => Object.fromEntries(await Promise.all(NATIVE_BATCH_EXTENSIONS.map(async extension => [
      extension,
      await read(`pages/index/index.${extension}`),
    ] as const)))
    const assertPageOutputs = async () => {
      const outputs = await pageOutputs()
      for (const extension of NATIVE_BATCH_EXTENSIONS) {
        expect(outputs[extension], `Published page ${extension} must remain present`).not.toBe('')
      }
    }
    const assertSidecar = async (marker: string) => {
      await dev!.waitFor(expect.poll(async () => JSON.parse(await read('sitemap.json')) as unknown, { timeout: 30_000 })
        .toEqual({ desc: marker, rules: [] }), `standalone JSON publication ${marker}`)
      await assertPageOutputs()
    }
    try {
      const appFile = path.join(project, 'src/app.json')
      const app = JSON.parse(await readFile(appFile, 'utf8')) as Record<string, unknown>
      await writeFile(appFile, JSON.stringify({ ...app, sitemapLocation: 'sitemap.json' }))
      await writeFile(source, json('WATCHER_JSON_INITIAL'))
      await mkdir(path.dirname(card))
      await writeFile(card, template('WATCHER_CARD_INITIAL'))
      const page = path.join(project, 'src/pages/index/index.wxml')
      await writeFile(page, `${await readFile(page, 'utf8')}\n<import src="../../shared/card.wxml"/><template is="watcherCard"/>\n`)
      stage = 'initial-build'
      dev = startDevProcess(process.execPath, [NATIVE_BATCH_CLI, 'dev', '--non-interactive'], {
        cwd: project,
        env: createDevProcessEnv({ usePolling: false }),
        all: true,
      })
      await dev.waitForInitialBuild()
      await assertSidecar('WATCHER_JSON_INITIAL')
      await expect.poll(() => read('shared/card.wxml'), { timeout: 30_000 }).toContain('WATCHER_CARD_INITIAL')

      // 每次只保存输入一次；最终产物消费该版本后才开始下一次保存。
      for (const marker of ['WATCHER_JSON_FIRST', 'WATCHER_JSON_NEXT']) {
        stage = marker
        await writeFile(source, json(marker))
        await assertSidecar(marker)
      }
      stage = 'atomic-replacement'
      await writeFile(`${source}.pending`, json('WATCHER_JSON_ATOMIC'))
      await renameAtomicFile(`${source}.pending`, source)
      await assertSidecar('WATCHER_JSON_ATOMIC')
      stage = 'save-after-atomic-replacement'
      await writeFile(source, json('WATCHER_JSON_AFTER_ATOMIC'))
      await assertSidecar('WATCHER_JSON_AFTER_ATOMIC')
      expect(dev.getBuildErrors()).toEqual([])

      // 可选 JSON 缺失不要求报错；被页面引用的 WXML 缺失必须保留上次完整产物。
      const publishedPages = await pageOutputs()
      const publishedCard = await read('shared/card.wxml')
      const publishedJson = await read('sitemap.json')
      const failureOffset = dev.getOutput().length
      stage = 'referenced-template-deletion'
      await rm(card)
      await dev.waitFor(expect.poll(() => dev!.getOutput().slice(failureOffset), { timeout: 30_000 })
        .toMatch(/ENOENT[\s\S]*shared[/\\]card\.wxml/), 'missing referenced template error')
      expect(await pageOutputs()).toEqual(publishedPages)
      expect(await read('shared/card.wxml')).toBe(publishedCard)
      expect(await read('sitemap.json')).toBe(publishedJson)

      const recoveryOffset = dev.getOutput().length
      stage = 'referenced-template-recreation'
      await writeFile(card, template('WATCHER_CARD_RECREATED'))
      await dev.waitFor(expect.poll(() => read('shared/card.wxml'), { timeout: 30_000 })
        .toContain('WATCHER_CARD_RECREATED'), 'recreated referenced template publication')
      await assertPageOutputs()
      stage = 'save-after-recreation'
      await writeFile(card, template('WATCHER_CARD_AFTER_RECREATE'))
      await dev.waitFor(expect.poll(() => read('shared/card.wxml'), { timeout: 30_000 })
        .toContain('WATCHER_CARD_AFTER_RECREATE'), 'subsequent referenced template publication')
      await assertPageOutputs()
      expect(await read('sitemap.json')).toBe(publishedJson)
      expect(dev.getOutput().slice(recoveryOffset)).not.toMatch(/ENOENT|Build failed|delivery failed|patch transform failed/)
    }
    finally {
      await dev?.stop()
      await rm(project, { recursive: true, force: true })
    }
  }, 180_000)
})
