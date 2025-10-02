import type { ResolvedValue } from '../../auto-import-components/resolvers'
import type { Entry } from '../../types'

export interface LocalAutoImportMatch {
  kind: 'local'
  entry: Entry
  value: ResolvedValue
}
