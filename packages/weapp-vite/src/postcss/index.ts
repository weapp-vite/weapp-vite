import postcss from 'postcss'
import { postCreator } from './post'

export function cssPostProcess(css: string) {
  return postcss([postCreator()]).process(css).async()
}
