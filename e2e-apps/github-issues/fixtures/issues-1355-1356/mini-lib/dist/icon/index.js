const { __rest } = require('tslib')
const loadMissingRuntimeModule = () => require('./missing-runtime.js')

Component({
  data: __rest({ marker: 'cross-package dependency retained' }, []),
})
