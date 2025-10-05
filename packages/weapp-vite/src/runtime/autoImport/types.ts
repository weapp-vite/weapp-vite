import type { ResolvedValue } from '../../auto-import-components/resolvers'
import type { ComponentEntry } from '../../types'

export interface LocalAutoImportMatch {
  kind: 'local'
  entry: ComponentEntry
  value: ResolvedValue
}
