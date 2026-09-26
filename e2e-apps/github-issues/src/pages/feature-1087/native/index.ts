import {
  getFeature1087Controller,
  readFeature1087Probe,
  releaseFeature1087Restore,
  resetFeature1087,
} from '../../../shared/feature1087'

Page({
  _snapshot: readFeature1087Probe,
  _reset: resetFeature1087,
  _release: releaseFeature1087Restore,
  _clear(key?: string) {
    getFeature1087Controller().clear(key)
  },
})
