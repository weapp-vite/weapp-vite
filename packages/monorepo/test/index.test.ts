import set from 'set-value'
// import path from 'pathe'
// import mm from 'micromatch'
// import { main } from '@/index'
// import { getTargets } from '@/targets'

describe('index', () => {
  it('foo bar', () => {
    const obj = {}
    set(obj, 'dev.@types/node', '1.1.1', { preservePaths: false })
    expect(obj).toEqual({
      dev: {
        '@types/node': '1.1.1',
      },
    })
  })

  it('foo', () => {
    const obj = {}
    set(obj, '@pnpm/workspace.find-packages'.replaceAll('.', '\\.'), '1.1.1', { preservePaths: false })
    expect(obj).toEqual({
      '@pnpm/workspace.find-packages': '1.1.1',
    })
  })

  // it.skip('copy', async () => {
  //   const target = path.resolve(__dirname, './fixtures/assets')
  //   await main(target)
  // })

  // it('should ', () => {
  //   const targets = getTargets()
  //   const res = mm.isMatch('.changeset/config.json', targets, {
  //     contains: true,
  //   })
  //   expect(res).toBe(true)
  // })
})
