import { access, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { expect, it } from 'vitest'
import { assertLiveClassicLeaseConflict, cleanupClassicLeaseProject, leaveCrashedClassicLease, startClassicLeaseDev, stopClassicLeaseDev, stopFailedClassicLeaseDev } from '../utils/classicLeaseRecovery'
import { runCleanupSteps } from '../utils/cleanupSteps'
import { createIssueRegressionProject } from '../utils/issueRegressionProject'

it.each([true, false])('recovers a crashed real CLI, rejects live competitors and restores the original private config (exists=%s)', async (configExists) => {
  const project = await createIssueRegressionProject(1278)
  const config = path.join(project, 'project.private.config.json')
  const journal = path.join(project, '.weapp-vite/ide-classic-project.private.config.json')
  let original: string | undefined
  let dev: ReturnType<typeof startClassicLeaseDev> | undefined
  let primaryError: unknown
  try {
    original = configExists ? await readFile(config, 'utf8') : undefined
    if (!configExists) {
      await rm(config)
    }
    const crashed = await leaveCrashedClassicLease(project)
    dev = startClassicLeaseDev(project)
    await dev.waitForInitialBuild()
    const saved = await readFile(journal, 'utf8')
    expect(JSON.parse(saved)).not.toHaveProperty('owner', crashed.owner)
    const installed = await readFile(config, 'utf8')
    expect(JSON.parse(installed)).toHaveProperty('setting.compileHotReLoad', false)
    await assertLiveClassicLeaseConflict(project)
    expect(await readFile(journal, 'utf8')).toBe(saved)
    expect(await readFile(config, 'utf8')).toBe(installed)
    const app = JSON.parse(await readFile(path.join(project, 'dist/app.json'), 'utf8')) as { pages: string[] }
    expect(app.pages).toEqual(['pages/index/index'])
    for (const extension of ['js', 'json', 'wxml']) {
      await access(path.join(project, `dist/pages/index/index.${extension}`))
    }
    expect(dev.getBuildErrors()).toEqual([])
    await stopClassicLeaseDev(dev)
    dev = undefined
    if (original === undefined) {
      await expect(access(config)).rejects.toMatchObject({ code: 'ENOENT' })
    }
    else {
      expect(await readFile(config, 'utf8')).toBe(original)
    }
    await expect(access(journal)).rejects.toMatchObject({ code: 'ENOENT' })
  }
  catch (error) {
    primaryError = error
    throw error
  }
  finally {
    await cleanupClassicLeaseProject(project, () => runCleanupSteps([
      { label: 'restarted classic CLI', run: async () => {
        if (dev) {
          if (primaryError !== undefined) {
            await stopFailedClassicLeaseDev(dev)
          }
          else {
            await stopClassicLeaseDev(dev)
          }
        }
      } },
    ]), primaryError)
  }
}, 180_000)
