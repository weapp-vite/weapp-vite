// import * as utils from './utis.wxs'
const utils = require('./utis.wxs')
export function getRowStyles(gutter, style, customStyle) {
  var _style = '';
  if (gutter) {
    _style = utils._style({
      'margin-right': utils.addUnit(-gutter / 2),
      'margin-left': utils.addUnit(-gutter / 2),
    });
  }

  return utils._style([style, customStyle]) + _style;
}

