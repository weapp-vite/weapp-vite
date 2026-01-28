export { createWevuAutoPageFeaturesPlugin } from './pageFeatures/plugin'
export {
  collectWevuPageFeatureFlags,
  createPageEntryMatcher,
  injectWevuPageFeatureFlagsIntoOptionsObject,
  injectWevuPageFeaturesInJs,
  injectWevuPageFeaturesInJsWithResolver,
} from 'wevu/compiler'
export type { ModuleResolver, WevuPageFeatureFlag, WevuPageHookName } from 'wevu/compiler'
