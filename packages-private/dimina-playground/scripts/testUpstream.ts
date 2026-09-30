import { preparedRoot } from './preparation'
import { testUpstream } from './upstreamTests'

await testUpstream(await preparedRoot())
