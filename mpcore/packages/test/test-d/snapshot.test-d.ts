import type { HeadlessTestingPageSnapshot } from '@mpcore/simulator'
import type { MiniProgramNode, MiniProgramScreen, MiniProgramTreeSnapshot } from '@mpcore/test'
import { mpcoreSnapshotSerializer, toMiniProgramSnapshot } from '@mpcore/test'
import { expectError, expectType } from 'tsd'

declare const screen: MiniProgramScreen
declare const node: MiniProgramNode
declare const diagnostic: HeadlessTestingPageSnapshot
declare const unknownValue: unknown

expectType<MiniProgramTreeSnapshot>(screen.snapshot())
expectType<MiniProgramTreeSnapshot>(node.snapshot())
expectType<MiniProgramTreeSnapshot>(toMiniProgramSnapshot(screen))
expectType<MiniProgramTreeSnapshot>(toMiniProgramSnapshot(node))
expectType<MiniProgramTreeSnapshot>(toMiniProgramSnapshot(diagnostic))
expectType<boolean>(mpcoreSnapshotSerializer.test(unknownValue))
expectType<string>(mpcoreSnapshotSerializer.serialize(node))
expectError(toMiniProgramSnapshot({ root: 'not-a-tree' }))
expectError(toMiniProgramSnapshot('not-a-snapshot'))
