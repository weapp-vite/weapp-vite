import { state } from './shared'

state.evaluations += 1

export default () => state.value * 3
