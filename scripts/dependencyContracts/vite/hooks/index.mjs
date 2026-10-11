import { evaluateStrict, extract } from '../helpers.mjs'
import { verifyFailedWrites, verifyMetadata, verifyReentrantWrites } from './behavior.mjs'
import { verifyOwnership } from './ownership.mjs'

export async function verifyHooks(source) {
  const fragment = extract(source, 'const wrappedHookMap =', '\nfunction wrapEnvironmentResolveId')
  const { wrap } = evaluateStrict(`${fragment}\nglobalThis.wrap = wrapHookObject;`, { WeakRef })
  verifyMetadata(wrap)
  verifyFailedWrites(wrap)
  verifyReentrantWrites(wrap)
  return ['hook-metadata', 'failed-broadcast', 'reentrant-broadcast', ...await verifyOwnership(wrap)]
}
