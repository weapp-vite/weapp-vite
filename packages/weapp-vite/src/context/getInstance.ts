import type { CompilerContext } from './CompilerContext'
import { container } from '@/inversify.config'
import { Symbols } from './Symbols'

export function getCompilerContext() {
  return container.get<CompilerContext>(Symbols.CompilerContext)
}
