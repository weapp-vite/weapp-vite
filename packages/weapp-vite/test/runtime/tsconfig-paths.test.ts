import { shouldEnableTsconfigPathsPlugin } from '@/runtime/config/internal/tsconfigPaths'
import { getFixture } from '../utils'

describe('shouldEnableTsconfigPathsPlugin', () => {
  it('detects paths from referenced configs', async () => {
    const cwd = getFixture('tsconfig-paths/refs')
    await expect(shouldEnableTsconfigPathsPlugin(cwd)).resolves.toBe(true)
  })

  it('returns false when no paths or baseUrl exist', async () => {
    const cwd = getFixture('tsconfig-paths/no-paths')
    await expect(shouldEnableTsconfigPathsPlugin(cwd)).resolves.toBe(false)
  })
})
