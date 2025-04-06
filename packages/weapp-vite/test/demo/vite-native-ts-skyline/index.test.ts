import { isCI } from 'ci-info'
import { fdir as Fdir } from 'fdir'
import fs from 'fs-extra'
import path from 'pathe'
import { appRoot } from '../shared'

const demoRoot = path.resolve(appRoot, 'vite-native-ts-skyline')

describe('disasync t', () => {
  it.skipIf(isCI)('dist', async () => {
    const fdir = new Fdir()
    const s = await fdir.withRelativePaths().crawl(
      path.resolve(demoRoot, 'dist'),
    ).withPromise()
    await fs.outputJSON(path.resolve(__dirname, './before.json'), s.sort(), {
      spaces: 2,
    })
  })
})
