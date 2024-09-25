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
