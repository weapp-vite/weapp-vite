import { isCI } from 'ci-info'
import { fdir as Fdir } from 'fdir'
import fs from 'fs-extra'
import path from 'pathe'
import { viteNativeRoot } from './shared'

describe('disasync t', () => {
  it.skip('dist', async () => {
    const fdir = new Fdir()
    const s = await fdir.withRelativePaths().crawl(
      path.resolve(viteNativeRoot, 'dist'),
    ).withPromise()
    await fs.outputJSON(path.resolve(__dirname, './before.json'), s.sort(), {
      spaces: 2,
    })
  })

  it.skipIf(isCI)('dist-next', async () => {
    const fdir = new Fdir()
    const s = await fdir.withRelativePaths().crawl(
      path.resolve(viteNativeRoot, 'dist-next'),
    ).withPromise()
    await fs.outputJSON(path.resolve(__dirname, './after.json'), s.sort(), {
      spaces: 2,
    })
  })
})
