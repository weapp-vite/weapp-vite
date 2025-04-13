import { fdir } from 'fdir'
import path from 'pathe'

export const appsDir = path.resolve(__dirname, '../../../apps')

export function getApp(app: string) {
  return path.resolve(appsDir, app)
}

const fixturesDir = path.resolve(__dirname, './fixtures')

export function getFixture(dir: string) {
  return path.resolve(fixturesDir, dir)
}

export const dirs = [
  // 'native',
  // 'native-skyline',
  // 'native-ts',
  // 'native-ts-skyline',
  'vite-native',
  'vite-native-skyline',
  'vite-native-ts',
  'vite-native-ts-skyline',
]

export const absDirs = dirs.map((x) => {
  return {
    name: x,
    path: getApp(x),
  }
})

export async function scanFiles(root: string) {
  // eslint-disable-next-line new-cap
  const fd = new fdir(
    {
      relativePaths: true,
    },
  )
  const files = (await fd.crawl(root).withPromise()).sort()
  return files
}

export function createTask() {
  const result: {
    resolve: (value: unknown) => void
    reject: (reason?: any) => void
    promise: Promise<unknown>
    reset: () => void
  } = {
    resolve: () => {},
    reject: () => {},
    promise: Promise.resolve(),
    reset: () => {
      result.promise = new Promise((_resolve, _reject) => {
        result.resolve = _resolve
        result.reject = _reject
      })
    },
  }

  result.reset()

  return result
}
