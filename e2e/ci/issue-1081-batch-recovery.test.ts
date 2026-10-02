import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE } from '@weapp-core/constants'
import { expect, it } from 'vitest'
import { parseStatefulHmrControlSource } from '../../scripts/workspace-hmr/scenarios'
import { StatefulHmrAuditClient } from '../../scripts/workspace-hmr/statefulAuditClient'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { readEmittedStylesheet } from '../utils/emittedStylesheet'
import { createIssue1081Project, ISSUE_1081_CLI } from '../utils/issue1081Project'

it('does not publish invalid compilation and recovers with a matching script and stylesheet', async () => {
  const project = await createIssue1081Project('issue-1081-transaction')
  const dev = startDevProcess(process.execPath, [ISSUE_1081_CLI, 'dev', '--non-interactive'], {
    cwd: project,
    env: createDevProcessEnv(),
    reject: false,
  })
  const output = path.join(project, 'dist')
  const source = path.join(project, 'src/batch.ts')
  const control = async () => parseStatefulHmrControlSource(await readFile(path.join(output, WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE), 'utf8'))
  const client = new StatefulHmrAuditClient()
  try {
    await dev.waitForInitialBuild()
    await client.ensureRegistered(await control(), 10_000)
    const styles = await readEmittedStylesheet(path.join(output, 'app.wxss'))
    const beforePatch = await readFile(path.join(output, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE), 'utf8')
    await writeFile(source, 'export const label = \'invalid\'\nexport const utility = \'bg-[#abcdef]\'\n// BATCH_FAIL\n')
    await expect.poll(() => dev.getOutput(), { timeout: 30_000 }).toContain('issue1081 injected transform failure')
    expect(await readEmittedStylesheet(path.join(output, 'app.wxss'))).toBe(styles)
    expect(await readFile(path.join(output, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE), 'utf8')).toBe(beforePatch)
    await writeFile(source, 'export const label = \'recovered\'\nexport const utility = \'bg-[#dcfce7]\'\n')
    await expect.poll(async () => {
      await client.ensureRegistered(await control(), 10_000)
      await client.poll(10_000)
      return [
        await readFile(path.join(output, 'pages/index/index.js'), 'utf8'),
        await readFile(path.join(output, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE), 'utf8'),
      ].join('\n')
    }, { timeout: 45_000 }).toContain('recovered')
    await client.acknowledgePublished(10_000)
    await expect.poll(() => readEmittedStylesheet(path.join(output, 'app.wxss')), { timeout: 45_000 }).toContain('#dcfce7')
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
