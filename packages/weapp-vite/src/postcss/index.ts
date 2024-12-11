import postcss from 'postcss'
import { postCreator } from './post'

export async function cssPostProcess(code: string) {
  if (!code.includes('@weapp-vite')) {
    return code
  }
  const { css } = await postcss([postCreator()]).process(code).async()
  return css
}
