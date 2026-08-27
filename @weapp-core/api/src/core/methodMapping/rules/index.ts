import type { WeapiMethodMappingRule } from '../types'
import { normalizePlatformName } from './helpers'
import { MY_METHOD_MAPPINGS } from './my'
import { TT_METHOD_MAPPINGS } from './tt'

export { normalizePlatformName }

export const METHOD_MAPPINGS: Readonly<Record<string, Readonly<Record<string, WeapiMethodMappingRule>>>> = {
  my: MY_METHOD_MAPPINGS,
  tt: TT_METHOD_MAPPINGS,
}
