import { it } from 'vitest'
import { assertSetDataPhases } from './helpers/setDataPhaseAssertions'
import { createSetDataPhaseFiles } from './helpers/setDataPhases'

it('preserves IDE phase boundaries and delayed adapter completion', async () => {
  await assertSetDataPhases(await createSetDataPhaseFiles())
})
