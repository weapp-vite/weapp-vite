<script setup lang="ts">
import type { SlotContext } from './context'
import { inject } from 'wevu'
import { SLOT_CONTEXT } from './context'
import { sharedProbe } from './sharedProbe'

const contextGlobal = globalThis as typeof globalThis & { issue1172ContextSource?: { readonly current: SlotContext | undefined } }
contextGlobal.issue1172ContextSource = {
  get current() {
    return inject<SlotContext | undefined>(SLOT_CONTEXT, undefined)
  },
}
Object.defineProperty(sharedProbe, 'label', {
  get: () => inject<SlotContext | undefined>(SLOT_CONTEXT, undefined)?.label ?? 'missing',
})

defineAppJson({
  pages: [
    'pages/index/index',
    'pages/isolation/index',
    'pages/nesting/index',
    'pages/lifecycle/index',
    'pages/native-export/index',
    'pages/exported-owner/index',
    'pages/unprojected/index',
    'pages/keyed/index',
    'pages/plain/index',
  ],
  window: { navigationStyle: 'custom' },
})
</script>
