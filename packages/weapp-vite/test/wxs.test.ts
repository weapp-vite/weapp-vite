import { buildWxs } from '@/utils/wxs'
import path from 'pathe'
import { getApp } from './utils'

const viteNativeRoot = getApp('vite-native')

function r(...args: string[]) {
  return path.resolve(viteNativeRoot, ...args)
}

describe('wxs', () => {
  it('build wxs case 0', async () => {
    await buildWxs({
      entryPoints: [
        r('pages/index/index.wxs.ts'),
      ],
      outdir: './fixtures/wxsCase0',
    })
  })

  it('build wxs case 1', async () => {
    await buildWxs({
      entryPoints: [
        r('pages/index/test.wxs'),
      ],
      outdir: './fixtures/wxsCase1',
    })
  })

  it('build wxs case 2', async () => {
    await buildWxs({
      entryPoints: [
        r('pages/index/test.ts'),
      ],
      outdir: './fixtures/wxsCase2',
      tsconfig: r('tsconfig.json'),
    })
  })
})
