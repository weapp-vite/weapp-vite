import type * as wevuVueDemi from 'wevu/vue-demi'
import { expectType } from 'tsd'

type WevuVueDemiEntry = typeof import('wevu/vue-demi')

declare const vueDemiEntry: WevuVueDemiEntry

expectType<boolean>(vueDemiEntry.isVue2)
expectType<boolean>(vueDemiEntry.isVue3)
expectType<undefined>(vueDemiEntry.Vue2)
expectType<() => void>(vueDemiEntry.install)
expectType<string>(vueDemiEntry.version)
expectType<typeof wevuVueDemi.ref>(vueDemiEntry.ref)
expectType<typeof wevuVueDemi.watchEffect>(vueDemiEntry.watchEffect)
expectType<typeof wevuVueDemi.inject>(vueDemiEntry.inject)
