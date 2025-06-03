import type { Plugin } from 'vite'
import type { CompilerContext } from '@/context'

export function wxPlugin(_ctx: CompilerContext): Plugin[] {
  const plugins: Plugin[] = []

  plugins.push({
    name: 'weapp-vite:wx-plugin',
    enforce: 'pre',
  })

  return plugins
}
