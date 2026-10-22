import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE } from '@weapp-core/constants'
import { expect, it } from 'vitest'
import { readHmrProfileLines } from '../../packages/weapp-vite/src/analyze/hmr/reader'
import { parseStatefulHmrControlSource } from '../../scripts/workspace-hmr/scenarios'
import { StatefulHmrAuditClient } from '../../scripts/workspace-hmr/statefulAuditClient'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { readEmittedStylesheet } from '../utils/emittedStylesheet'
import { renameAtomicFile } from '../utils/hmrAtomicRename'
import { createIssue1081Project, ISSUE_1081_CLI } from '../utils/issue1081Project'
import { createNativeHmrPublication } from '../utils/nativeHmrPublication'
import { captureNativePublication } from '../utils/nativePublication'
import { NATIVE_PUBLICATION_PREFIX } from '../utils/nativePublication/files'
import { addNativePublicationPlugin } from '../utils/nativePublication/fixture'

it('does not publish invalid compilation and recovers with a matching script and stylesheet', async () => {
  const project = await createIssue1081Project('issue-1081-transaction')
  const profilePath = path.join(project, '.weapp-vite/hmr-profile.jsonl')
  const config = path.join(project, 'weapp-vite.config.mjs')
  await writeFile(config, (await readFile(config, 'utf8')).replace(
    'hmr: { runtime: \'stateful-experimental\' }',
    `hmr: { runtime: 'stateful-experimental', profileJson: ${JSON.stringify(profilePath)} }`,
  ))
  await addNativePublicationPlugin(config)
  const dev = startDevProcess(process.execPath, [ISSUE_1081_CLI, 'dev', '--non-interactive'], {
    cwd: project,
    env: { ...createDevProcessEnv(), WEAPP_VITE_HMR_PROFILE_JSON: profilePath },
    reject: false,
  })
  const output = path.join(project, 'dist')
  const source = path.join(project, 'src/batch.ts')
  const control = async () => parseStatefulHmrControlSource(await readFile(path.join(output, WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE), 'utf8'))
  const client = new StatefulHmrAuditClient()
  const save = async (content: string) => {
    const pending = `${source}.pending`
    await writeFile(pending, content)
    await renameAtomicFile(pending, source)
  }
  const readOutputs = async () => {
    const files = (await readdir(output, { recursive: true })).sort()
    const contents = await Promise.all(files.map(async file => (await stat(path.join(output, file))).isFile()
      ? [file.replaceAll('\\', '/'), (await readFile(path.join(output, file))).toString('base64')] as const
      : undefined))
    return Object.fromEntries(contents.filter(value => value !== undefined))
  }
  try {
    await dev.waitForInitialBuild()
    await client.ensureRegistered(await control(), 10_000)
    const original = await readFile(source, 'utf8')
    const styles = await readEmittedStylesheet(path.join(output, 'app.wxss'))
    const beforePatch = await readFile(path.join(output, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE), 'utf8')
    const beforeOutputs = await readOutputs()
    const failureOffset = dev.getOutput().length
    const beforeFailureProfile = await readFile(profilePath, 'utf8').catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
      return ''
    })
    const failureProfileCursor = beforeFailureProfile.lastIndexOf('\n') + 1
    const failedPublication = captureNativePublication(dev, project)
    // 原子替换避免原地截断先发布合法的空模块，故障批次必须保持原生输出不变。
    await save('export const label = \'invalid\'\nexport const utility = \'bg-[#abcdef]\'\n// BATCH_FAIL\n')
    await expect.poll(() => dev.getOutput().slice(failureOffset), { timeout: 30_000 }).toContain('issue1081 injected transform failure')
    await expect(failedPublication.wait()).rejects.toThrow('Native publication failed')
    await expect.poll(async () => {
      const content = await readFile(profilePath, 'utf8')
      expect(content.startsWith(beforeFailureProfile)).toBe(true)
      const fresh = content.slice(failureProfileCursor, content.lastIndexOf('\n') + 1)
      expect(readHmrProfileLines(fresh).coverage.invalid).toBe(0)
      return fresh.split(/\r?\n/).filter(Boolean).some((line) => {
        const sample: unknown = JSON.parse(line)
        if (!sample || typeof sample !== 'object' || !('status' in sample) || sample.status !== 'failed') {
          return false
        }
        // 原生补丁错误不携带 generation；这里只验编辑游标后的真实未知失败，不能伪造文件事件。
        expect(sample).toMatchObject({ schemaVersion: 1, pipeline: 'stateful', correlation: 'unknown', sourceEvents: [] })
        expect(sample).not.toHaveProperty('eventId')
        expect(sample).not.toHaveProperty('file')
        return true
      })
    }, { timeout: 30_000 }).toBe(true)
    expect(await readEmittedStylesheet(path.join(output, 'app.wxss'))).toBe(styles)
    expect(await readFile(path.join(output, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE), 'utf8')).toBe(beforePatch)
    expect(await readOutputs()).toEqual(beforeOutputs)
    expect(dev.getOutput().slice(failureOffset)).not.toContain(NATIVE_PUBLICATION_PREFIX)
    expect(dev.getOutput()).not.toContain('[weapp-vite] HMR fallback ')
    await expect.poll(() => dev.getBuildErrors()).toHaveLength(1)
    expect(dev.getBuildErrors()[0]!.replace(/^\[error\]\s+/, '')).toBe('[weapp-vite] stateful HMR: Build failed with 1 error:')

    // 保留完整故障日志；后续发布只消费恢复保存之后的新证据，历史错误不能伪装成回退原因。
    const recoveryOffset = dev.getOutput().length
    const recoveryDev = { ...dev, getOutput: () => dev.getOutput().slice(recoveryOffset) }
    const publication = createNativeHmrPublication(project, recoveryDev, 'stateful-experimental', ['stylesheet-output'], profilePath)
    const recoveredPublication = publication.capture(source)
    await save('export const label = \'recovered\'\nexport const utility = \'bg-[#dcfce7]\'\n')
    await recoveredPublication.wait()
    expect(await readFile(path.join(output, 'pages/index/index.js'), 'utf8')).toContain('recovered')
    await expect.poll(() => readEmittedStylesheet(path.join(output, 'app.wxss')), { timeout: 45_000 }).toContain('#dcfce7')
    expect(publication.stateful).toBe(false)

    const repeatedPublication = publication.capture(source)
    await save('export const label = \'classic-followup\'\nexport const utility = \'bg-[#dbeafe]\'\n')
    await repeatedPublication.wait()
    expect(await readFile(path.join(output, 'pages/index/index.js'), 'utf8')).toContain('classic-followup')
    expect(await readEmittedStylesheet(path.join(output, 'app.wxss'))).toContain('#dbeafe')

    const restoredPublication = publication.capture(source)
    await save(original)
    await restoredPublication.wait()
    expect(await readFile(source, 'utf8')).toBe(original)
    expect(await readFile(path.join(output, 'pages/index/index.js'), 'utf8')).toContain('initial')
    expect(await readEmittedStylesheet(path.join(output, 'app.wxss'))).toContain('#fce7f3')
    await publication.assertClassicOutput()
    expect(dev.getBuildErrors()).toHaveLength(1)
    expect(dev.getOutput()).not.toMatch(/delivery failed|patch transform failed|classic HMR 切换失败|classic 回退失败/)
  }
  catch (error) {
    process.stdout.write(dev.getOutput())
    throw error
  }
  finally {
    await dev.stop()
    await rm(project, { recursive: true, force: true })
  }
}, 120_000)
