import type { WrapPluginOptions } from './types'

export function getDefaultOptions(): WrapPluginOptions {
  return {
    threshold: 0,
    hooks: [
      'options',
      'buildStart',
      'resolveId',
      'load',
      'transform',
      'buildEnd',
      'generateBundle',
      'renderChunk',
      'writeBundle',
    ],
    slient: false,
  }
}
