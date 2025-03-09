import type { VueLanguagePlugin } from '@vue/language-core'
import { name } from '../package.json'

const BLOCK_TYPE = 'config'

const plugin: VueLanguagePlugin = () => {
  return {
    name,
    version: 2.1,
    getEmbeddedCodes(_fileName, sfc) {
      const names = []
      for (let i = 0; i < sfc.customBlocks.length; i++) {
        const block = sfc.customBlocks[i]
        if (block.type === BLOCK_TYPE) {
          const lang = block.lang === 'txt' ? 'json' : block.lang
          // const lang = block.lang || 'json'
          names.push({ id: `${BLOCK_TYPE}_${i}`, lang })
        }
      }
      return names
    },
    resolveEmbeddedCode(_fileName, sfc, embeddedCode) {
      const match = embeddedCode.id.match(new RegExp(`^${BLOCK_TYPE}_(\\d+)$`))
      if (match) {
        const index = Number.parseInt(match[1])
        const block = sfc.customBlocks[index]
        embeddedCode.content.push([
          block.content,
          block.name,
          0,
          {
            verification: true,
            completion: true,
            semantic: true,
            navigation: true,
            structure: true,
            format: true,
          },
        ])
      }
    },
  }
}

export default plugin
