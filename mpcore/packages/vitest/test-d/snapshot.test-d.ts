import type { MiniProgramScreen } from '@mpcore/vitest'
import { mpcoreSnapshotSerializer, toMiniProgramSnapshot } from '@mpcore/vitest'
import { expectType } from 'tsd'
import { expect } from 'vitest'

declare const screen: MiniProgramScreen

expectType<void>(expect.addSnapshotSerializer(mpcoreSnapshotSerializer))
expectType<void>(expect(toMiniProgramSnapshot(screen)).toMatchSnapshot())
