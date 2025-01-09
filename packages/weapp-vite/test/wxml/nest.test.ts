import { scanWxml } from '@/wxml'

describe('nest', () => {
  it('https://github.com/weapp-vite/weapp-vite/issues/87', () => {
    const { components } = scanWxml(`<xxx>
        <yyy class="yyy">
          <zzz></zzz>
        </yyy>
      </xxx>`)
    const coms = Object.entries(components)
    expect(coms.length).toBe(3)
  })
})
