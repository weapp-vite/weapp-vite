import type { CompilerContext } from '@/context'
import type { Plugin } from 'vite'

export function wxPlugin(_ctx: CompilerContext): Plugin[] {
  const plugins: Plugin[] = []

  plugins.push({
    name: 'weapp-vite:wx-plugin',
    enforce: 'pre',
  })

  return plugins
}
