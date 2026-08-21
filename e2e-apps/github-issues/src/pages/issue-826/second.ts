import { sharedService } from '../../issue-fixtures/issue-826/services/shared'
import { barrelValue } from '../../issue-fixtures/issue-826/utils/barrel'
import { sharedUtil } from '../../issue-fixtures/issue-826/utils/shared'

Page({
  data: {
    value: [sharedUtil(), barrelValue(), sharedService()].join('|'),
  },
})
