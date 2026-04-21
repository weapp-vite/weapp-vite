import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveJsFormatConfigOverride } from './jsFormat'

const cleanupTargets = new Set<string>()

async function createTempProject(prefix: string) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix))
  cleanupTargets.add(root)
  return root
}

afterEach(async () => {
  await Promise.all(
    Array.from(cleanupTargets).map(async (target) => {
      await fs.rm(target, { recursive: true, force: true })
    }),
  )
  cleanupTargets.clear()
})

describe('jsFormat test config override', () => {
  it('returns original config when no jsFormat override is requested', async () => {
    const projectRoot = await createTempProject('weapp-vite-js-format-none-')
    const result = await resolveJsFormatConfigOverride({
      projectRoot,
    })

    expect(result.configFile).toBeUndefined()
    await result.cleanup()
  })

  it('creates a standalone config when project has no config file', async () => {
    const projectRoot = await createTempProject('weapp-vite-js-format-empty-')
    const result = await resolveJsFormatConfigOverride({
      projectRoot,
      jsFormat: 'esm',
    })

    expect(result.configFile).toBeTruthy()
    const content = await fs.readFile(result.configFile!, 'utf8')
    expect(content).toContain(`jsFormat: 'esm'`)
    expect(content).toContain(`export default defineConfig({`)

    await result.cleanup()
    expect(await fs.access(result.configFile!).then(() => true).catch(() => false)).toBe(false)
  })

  it('wraps existing config files and merges jsFormat override', async () => {
    const projectRoot = await createTempProject('weapp-vite-js-format-wrap-')
    const sourceConfigPath = path.join(projectRoot, 'weapp-vite.config.ts')
    await fs.writeFile(sourceConfigPath, 'export default { weapp: { autoRoutes: true } }\n', 'utf8')

    const result = await resolveJsFormatConfigOverride({
      projectRoot,
      jsFormat: 'cjs',
    })

    expect(result.configFile).toBeTruthy()
    const content = await fs.readFile(result.configFile!, 'utf8')
    expect(content).toContain(`import { mergeConfig } from 'vite'`)
    expect(content).toContain(pathToFileURL(sourceConfigPath).href)
    expect(content).toContain(`jsFormat: 'cjs'`)
    expect(content).toContain(`return mergeConfig(config ?? {}, jsFormatOverride)`)

    await result.cleanup()
  })
})
