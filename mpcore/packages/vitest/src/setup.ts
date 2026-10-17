import { mpcoreMatchers, mpcoreSnapshotSerializer } from '@mpcore/test'
import { expect } from 'vitest'

expect.extend(mpcoreMatchers)
expect.addSnapshotSerializer(mpcoreSnapshotSerializer)
