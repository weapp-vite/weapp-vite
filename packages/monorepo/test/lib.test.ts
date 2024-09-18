import { setPkgJson } from '@/lib'

describe('lib', () => {
  it('setPkgJson casae 0', () => {
    const t = {}
    const o = {}
    setPkgJson(t, o)
    expect(o).toMatchSnapshot()
  })

  it('setPkgJson casae 1', () => {
    const t = {

    }
    const o = {
      scripts: {
        'build': 'turbo run build',
        'dev': 'turbo run dev --parallel',
        'test': 'vitest run --coverage.enabled',
        'test:dev': 'vitest',
        'lint': 'turbo run lint',
        'release': 'changeset',
        'publish-packages': 'turbo run build lint test && changeset version && changeset publish',
        'preinstall': 'npx only-allow pnpm',
        'prepare': 'husky',
        'commit': 'commit',
      },
    }
    setPkgJson(t, o)
    expect(o).toMatchSnapshot()
  })
})
