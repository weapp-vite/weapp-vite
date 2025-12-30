import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import { createWevuAutoPageFeaturesPlugin } from './pageFeatures'

export function wevuPlugin(ctx: CompilerContext): Plugin[] {
  return [createWevuAutoPageFeaturesPlugin(ctx)]
}

export const wevu = wevuPlugin
