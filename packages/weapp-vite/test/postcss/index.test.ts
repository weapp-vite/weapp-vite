import { postCreator } from '@/postcss/post'
import postcss from 'postcss'

describe('postcss', () => {
  it('@weapp-vite-keep-import', async () => {
    const { css } = await postcss([postCreator()]).process('@weapp-vite-keep-import', { from: undefined })
    expect(css).toMatchSnapshot()
  })

  it('@weapp-vite-keep-import case 0', async () => {
    const { css } = await postcss([postCreator()]).process('@weapp-vite-keep-import \'xxx\'', { from: undefined })
    expect(css).toMatchSnapshot()
  })
})
