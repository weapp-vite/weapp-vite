import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { addNativePublicationPlugin } from './fixture'

it.each([
  { declaration: 'export default {', closing: '}' },
  { declaration: 'export default defineConfig({', closing: '})' },
  { declaration: 'export default defineConfig<UserConfig>({', closing: '})' },
  { declaration: 'export default defineConfig<Config<UserConfig>>({', closing: '})' },
])('preserves an existing plugin in $declaration', async ({ declaration, closing }) => {
  const project = await mkdtemp(path.join(tmpdir(), 'native-publication-config-'))
  const filename = path.join(project, 'weapp-vite.config.ts')
  try {
    const source = `${declaration}\n  plugins: [existingPlugin()],\n  weapp: { srcRoot: 'src' },\n${closing}\n`
    await writeFile(filename, source)
    await addNativePublicationPlugin(filename)
    const configured = await readFile(filename, 'utf8')
    expect(configured).toContain(declaration)
    expect(configured).toContain('plugins: [nativePublicationPlugin({ profilePath: process.env.WEAPP_VITE_HMR_PROFILE_JSON }), existingPlugin()]')
    expect(configured).toContain('import { nativePublicationPlugin } from ')
    expect(configured).toContain('weapp: { srcRoot: \'src\' }')
    expect(configured.endsWith(`${closing}\n`)).toBe(true)
  }
  finally {
    await rm(project, { recursive: true, force: true })
  }
})

it('adds an observer to a generic defineConfig without an existing plugin array', async () => {
  const project = await mkdtemp(path.join(tmpdir(), 'native-publication-config-'))
  const filename = path.join(project, 'weapp-vite.config.ts')
  try {
    await writeFile(filename, 'export default defineConfig<UserConfig>({\n  weapp: { srcRoot: \'src\' },\n})\n')
    await addNativePublicationPlugin(filename)
    const configured = await readFile(filename, 'utf8')
    expect(configured).toContain('export default defineConfig<UserConfig>({\n  plugins: [nativePublicationPlugin({ profilePath: process.env.WEAPP_VITE_HMR_PROFILE_JSON })],')
    expect(configured).toContain('weapp: { srcRoot: \'src\' }')
  }
  finally {
    await rm(project, { recursive: true, force: true })
  }
})
