// 本文件由 components.weapp.json 自动生成，请勿直接编辑。
/* eslint-disable style/comma-dangle, style/quote-props, style/quotes */

export const WEAPP_BUILTIN_HTML_TAGS_FORM_CONTROLS_SELECTION = [
  {
    "name": "picker",
    "description": "从底部弹起的滚动选择器。",
    "attributes": [
      {
        "name": "bindcancel",
        "description": "Type: function => any\nSince: 1.9.90"
      },
      {
        "name": "bindchange",
        "description": "Type: function => any\nvalue 改变时触发 change 事件，event.detail = {value, code, postcode}，其中字段 code 是统计用区划代码，postcode 是邮政编码"
      },
      {
        "name": "bindcolumnchange",
        "description": "Type: function => any\n列改变时触发"
      },
      {
        "name": "custom-item",
        "description": "Type: string\n可为每一列的顶部添加一个自定义的项\nSince: 1.5.0"
      },
      {
        "name": "disabled",
        "description": "Type: boolean\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "end",
        "description": "Type: string\n表示有效日期范围的结束，字符串格式为\"YYYY-MM-DD\""
      },
      {
        "name": "fields",
        "description": "Type: string\n有效值 year,month,day，表示选择器的粒度\nDefault: day"
      },
      {
        "name": "header-text",
        "description": "Type: string\nSince: 2.11.0"
      },
      {
        "name": "level",
        "description": "Type: string\n选择器层级\nDefault: region\nSince: 2.21.1"
      },
      {
        "name": "mode",
        "description": "Type: string\nDefault: selector\nSince: 1.0.0",
        "values": [
          {
            "name": "selector",
            "description": "普通选择器"
          },
          {
            "name": "multiSelector",
            "description": "多列选择器"
          },
          {
            "name": "time",
            "description": "时间选择器"
          },
          {
            "name": "date",
            "description": "日期选择器"
          },
          {
            "name": "region",
            "description": "省市区选择器"
          }
        ]
      },
      {
        "name": "range",
        "description": "Type: any[] | arrayobject\nmode 为 selector 或 multiSelector 时，range 有效\nDefault: []"
      },
      {
        "name": "range-key",
        "description": "Type: string\n当 range 是一个 Object Array 时，通过 range-key 来指定 Object 中 key 的值作为选择器显示内容"
      },
      {
        "name": "start",
        "description": "Type: string\n表示有效日期范围的开始，字符串格式为\"YYYY-MM-DD\""
      },
      {
        "name": "value",
        "description": "Type: any[]\n表示选中的省市区，默认选中每一列的第一个值\nDefault: []"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/picker.html"
      }
    ]
  },
  {
    "name": "picker-view",
    "description": "嵌入页面的滚动选择器。其中只可放置 [picker-view-column](https://developers.weixin.qq.com/miniprogram/dev/component/picker-view-column.html)组件，其它节点不会显示。\n目前滚动过程中 bindpickstart、bindpickend 会被触发多次，后续 skyline 升级会修复该问题",
    "attributes": [
      {
        "name": "bindchange",
        "description": "Type: function => any\n滚动选择时触发change事件，event.detail = {value}；value为数组，表示 picker-view 内的 picker-view-column 当前选择的是第几项（下标从 0 开始）\nSince: 1.0.0"
      },
      {
        "name": "bindpickend",
        "description": "Type: function => any\n当滚动选择结束时候触发事件\nSince: 2.3.1"
      },
      {
        "name": "bindpickstart",
        "description": "Type: function => any\n当滚动选择开始时候触发事件\nSince: 2.3.1"
      },
      {
        "name": "immediate-change",
        "description": "Type: boolean\n是否在手指松开时立即触发 change 事件。若不开启则会在滚动动画结束后触发 change 事件。\nDefault: false\nSince: 2.21.1"
      },
      {
        "name": "indicator-class",
        "description": "Type: string\n设置选择器中间选中框的类名\nSince: 1.1.0"
      },
      {
        "name": "indicator-style",
        "description": "Type: string\n设置选择器中间选中框的样式\nSince: 1.0.0"
      },
      {
        "name": "mask-class",
        "description": "Type: string\n设置蒙层的类名\nSince: 1.5.0"
      },
      {
        "name": "mask-style",
        "description": "Type: string\n设置蒙层的样式\nSince: 1.5.0"
      },
      {
        "name": "value",
        "description": "Type: number[]\n数组中的数字依次表示 picker-view 内的 picker-view-column 选择的第几项（下标从 0 开始），数字大于 picker-view-column 可选项长度时，选择最后一项。\nSince: 1.0.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/picker-view.html"
      }
    ]
  },
  {
    "name": "picker-view-column",
    "description": "嵌入页面的滚动选择器。其中只可放置 [picker-view-column](https://developers.weixin.qq.com/miniprogram/dev/component/picker-view-column.html)组件，其它节点不会显示。\n目前滚动过程中 bindpickstart、bindpickend 会被触发多次，后续 skyline 升级会修复该问题",
    "attributes": [
      {
        "name": "bindchange",
        "description": "Type: function => any\n滚动选择时触发change事件，event.detail = {value}；value为数组，表示 picker-view 内的 picker-view-column 当前选择的是第几项（下标从 0 开始）\nSince: 1.0.0"
      },
      {
        "name": "bindpickend",
        "description": "Type: function => any\n当滚动选择结束时候触发事件\nSince: 2.3.1"
      },
      {
        "name": "bindpickstart",
        "description": "Type: function => any\n当滚动选择开始时候触发事件\nSince: 2.3.1"
      },
      {
        "name": "immediate-change",
        "description": "Type: boolean\n是否在手指松开时立即触发 change 事件。若不开启则会在滚动动画结束后触发 change 事件。\nDefault: false\nSince: 2.21.1"
      },
      {
        "name": "indicator-class",
        "description": "Type: string\n设置选择器中间选中框的类名\nSince: 1.1.0"
      },
      {
        "name": "indicator-style",
        "description": "Type: string\n设置选择器中间选中框的样式\nSince: 1.0.0"
      },
      {
        "name": "mask-class",
        "description": "Type: string\n设置蒙层的类名\nSince: 1.5.0"
      },
      {
        "name": "mask-style",
        "description": "Type: string\n设置蒙层的样式\nSince: 1.5.0"
      },
      {
        "name": "value",
        "description": "Type: number[]\n数组中的数字依次表示 picker-view 内的 picker-view-column 选择的第几项（下标从 0 开始），数字大于 picker-view-column 可选项长度时，选择最后一项。\nSince: 1.0.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/picker-view.html"
      }
    ]
  },
  {
    "name": "progress",
    "description": "进度条。组件属性的长度单位默认为px，[2.4.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html)起支持传入单位(rpx/px)。",
    "attributes": [
      {
        "name": "active",
        "description": "Type: boolean\n进度条从左往右的动画\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "active-mode",
        "description": "Type: string\nbackwards: 动画从头播；forwards：动画从上次结束点接着播\nDefault: backwards\nSince: 1.7.0"
      },
      {
        "name": "activeColor",
        "description": "Type: string\n已选择的进度条的颜色\nDefault: #09BB07\nSince: 1.0.0"
      },
      {
        "name": "backgroundColor",
        "description": "Type: string\n未选择的进度条的颜色\nDefault: #EBEBEB\nSince: 1.0.0"
      },
      {
        "name": "bindactiveend",
        "description": "Type: function => any\n动画完成事件\nSince: 2.4.1"
      },
      {
        "name": "border-radius",
        "description": "Type: number | string\n圆角大小\nDefault: 0\nSince: 2.3.1"
      },
      {
        "name": "color",
        "description": "Type: string\n进度条颜色（请使用activeColor）\nDefault: #09BB07\nSince: 1.0.0"
      },
      {
        "name": "duration",
        "description": "Type: number\n进度增加1%所需毫秒数\nDefault: 30\nSince: 2.8.2"
      },
      {
        "name": "font-size",
        "description": "Type: number | string\n右侧百分比字体大小\nDefault: 16\nSince: 2.3.1"
      },
      {
        "name": "percent",
        "description": "Type: number\n百分比0~100\nSince: 1.0.0"
      },
      {
        "name": "show-info",
        "description": "Type: boolean\n在进度条右侧显示百分比\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "stroke-width",
        "description": "Type: number | string\n进度条线的宽度\nDefault: 6\nSince: 1.0.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/progress.html"
      }
    ]
  },
  {
    "name": "radio",
    "description": "单选项目。",
    "attributes": [
      {
        "name": "checked",
        "description": "Type: boolean\n当前是否选中\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "color",
        "description": "Type: string\nradio的颜色，同css的color\nDefault: #09BB07\nSince: 1.0.0"
      },
      {
        "name": "disabled",
        "description": "Type: boolean\n是否禁用\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "value",
        "description": "Type: string\n[radio](https://developers.weixin.qq.com/miniprogram/dev/component/radio.html) 标识。当该[radio](https://developers.weixin.qq.com/miniprogram/dev/component/radio.html) 选中时，[radio-group](https://developers.weixin.qq.com/miniprogram/dev/component/radio-group.html) 的 change 事件会携带[radio](https://developers.weixin.qq.com/miniprogram/dev/component/radio.html)的value\nSince: 1.0.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/radio.html"
      }
    ]
  },
  {
    "name": "radio-group",
    "description": "单选项目。",
    "attributes": [
      {
        "name": "checked",
        "description": "Type: boolean\n当前是否选中\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "color",
        "description": "Type: string\nradio的颜色，同css的color\nDefault: #09BB07\nSince: 1.0.0"
      },
      {
        "name": "disabled",
        "description": "Type: boolean\n是否禁用\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "value",
        "description": "Type: string\n[radio](https://developers.weixin.qq.com/miniprogram/dev/component/radio.html) 标识。当该[radio](https://developers.weixin.qq.com/miniprogram/dev/component/radio.html) 选中时，[radio-group](https://developers.weixin.qq.com/miniprogram/dev/component/radio-group.html) 的 change 事件会携带[radio](https://developers.weixin.qq.com/miniprogram/dev/component/radio.html)的value\nSince: 1.0.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/radio.html"
      }
    ]
  },
  {
    "name": "slider",
    "description": "滑动选择器。",
    "attributes": [
      {
        "name": "activeColor",
        "description": "Type: string\n已选择的颜色\nDefault: #1aad19\nSince: 1.0.0"
      },
      {
        "name": "backgroundColor",
        "description": "Type: string\n背景条的颜色\nDefault: #e9e9e9\nSince: 1.0.0"
      },
      {
        "name": "bindchange",
        "description": "Type: function => any\n完成一次拖动后触发的事件，event.detail = {value}\nSince: 1.0.0"
      },
      {
        "name": "bindchanging",
        "description": "Type: function => any\n拖动过程中触发的事件，event.detail = {value}\nSince: 1.7.0"
      },
      {
        "name": "block-color",
        "description": "Type: string\n滑块的颜色\nDefault: #ffffff\nSince: 1.9.0"
      },
      {
        "name": "block-size",
        "description": "Type: number\n滑块的大小，取值范围为 12 - 28\nDefault: 28\nSince: 1.9.0"
      },
      {
        "name": "color",
        "description": "Type: string\n背景条的颜色（请使用 backgroundColor）\nDefault: #e9e9e9\nSince: 1.0.0"
      },
      {
        "name": "disabled",
        "description": "Type: boolean\n是否禁用\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "max",
        "description": "Type: number\n最大值\nDefault: 100\nSince: 1.0.0"
      },
      {
        "name": "min",
        "description": "Type: number\n最小值\nDefault: 0\nSince: 1.0.0"
      },
      {
        "name": "selected-color",
        "description": "Type: string\n已选择的颜色（请使用 activeColor）\nDefault: #1aad19\nSince: 1.0.0"
      },
      {
        "name": "show-value",
        "description": "Type: boolean\n是否显示当前 value\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "step",
        "description": "Type: number\n步长，取值必须大于 0，并且可被(max - min)整除\nDefault: 1\nSince: 1.0.0"
      },
      {
        "name": "value",
        "description": "Type: number\n当前取值\nDefault: 0\nSince: 1.0.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/slider.html"
      }
    ]
  },
  {
    "name": "switch",
    "description": "开关选择器。",
    "attributes": [
      {
        "name": "bindchange",
        "description": "Type: function => any\n点击导致 checked 改变时会触发 change 事件，event.detail={ value}\nSince: 1.0.0"
      },
      {
        "name": "checked",
        "description": "Type: boolean\n是否选中\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "color",
        "description": "Type: string\nswitch 的颜色，同 css 的 color\nDefault: #04BE02\nSince: 1.0.0"
      },
      {
        "name": "disabled",
        "description": "Type: boolean\n是否禁用\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "type",
        "description": "Type: string\n样式，有效值：switch, checkbox\nDefault: switch\nSince: 1.0.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/switch.html"
      }
    ]
  },
  {
    "name": "textarea",
    "description": "多行输入框。该组件是[原生组件](https://developers.weixin.qq.com/miniprogram/dev/component/native-component.html)，使用时请注意相关限制。",
    "attributes": [
      {
        "name": "adjust-keyboard-to",
        "description": "Type: boolean\nDefault: cursor\nSince: 2.16.1",
        "values": [
          {
            "name": "cursor",
            "description": "对齐光标位置"
          },
          {
            "name": "bottom",
            "description": "对齐输入框底部"
          }
        ]
      },
      {
        "name": "adjust-position",
        "description": "Type: boolean\nDefault: true\nSince: 1.9.90"
      },
      {
        "name": "auto-focus",
        "description": "Type: boolean\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "auto-height",
        "description": "Type: boolean\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "bind:keyboardcompositionend",
        "description": "Type: function => any\n输入法输入结束时触发（仅当输入法支持时触发）\nSince: 3.2.0"
      },
      {
        "name": "bind:keyboardcompositionstart",
        "description": "Type: function => any\n输入法开始新的输入时触发 （仅当输入法支持时触发）\nSince: 3.2.0"
      },
      {
        "name": "bind:keyboardcompositionupdate",
        "description": "Type: function => any\n输入法输入字符时触发（仅当输入法支持时触发）\nSince: 3.2.0"
      },
      {
        "name": "bind:selectionchange",
        "description": "Type: function => any\n选区改变事件, {selectionStart, selectionEnd}\nSince: 3.2.0"
      },
      {
        "name": "bindblur",
        "description": "Type: function => any\nSince: 1.0.0"
      },
      {
        "name": "bindconfirm",
        "description": "Type: function => any\nSince: 1.0.0"
      },
      {
        "name": "bindfocus",
        "description": "Type: function => any\nSince: 1.0.0"
      },
      {
        "name": "bindinput",
        "description": "Type: function => any\nSince: 1.0.0"
      },
      {
        "name": "bindkeyboardheightchange",
        "description": "Type: function => any\nSince: 2.7.0"
      },
      {
        "name": "bindlinechange",
        "description": "Type: function => any\nSince: 1.0.0"
      },
      {
        "name": "confirm-hold",
        "description": "Type: boolean\nDefault: false\nSince: 2.16.0"
      },
      {
        "name": "confirm-type",
        "description": "Type: string\nDefault: return\nSince: 2.13.0",
        "values": [
          {
            "name": "send",
            "description": "右下角按钮为“发送”"
          },
          {
            "name": "search",
            "description": "右下角按钮为“搜索”"
          },
          {
            "name": "next",
            "description": "右下角按钮为“下一个”"
          },
          {
            "name": "go",
            "description": "右下角按钮为“前往”"
          },
          {
            "name": "done",
            "description": "右下角按钮为“完成”"
          },
          {
            "name": "return",
            "description": "右下角按钮为“换行”"
          }
        ]
      },
      {
        "name": "cursor",
        "description": "Type: number\nDefault: -1\nSince: 1.5.0"
      },
      {
        "name": "cursor-spacing",
        "description": "Type: number\nDefault: 0\nSince: 1.0.0"
      },
      {
        "name": "disable-default-padding",
        "description": "Type: boolean\nDefault: false\nSince: 2.10.0"
      },
      {
        "name": "disabled",
        "description": "Type: boolean\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "fixed",
        "description": "Type: boolean\n如果 textarea 是在一个 `position:fixed` 的区域，需要显示指定属性 fixed 为 true\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "focus",
        "description": "Type: boolean\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "hold-keyboard",
        "description": "Type: boolean\nDefault: false\nSince: 2.8.2"
      },
      {
        "name": "maxlength",
        "description": "Type: number\nDefault: 140\nSince: 1.0.0"
      },
      {
        "name": "placeholder",
        "description": "Type: string\nSince: 1.0.0"
      },
      {
        "name": "placeholder-class",
        "description": "Type: string\n指定 placeholder 的样式类，目前仅支持color,font-size和font-weight\nDefault: textarea-placeholder\nSince: 1.0.0"
      },
      {
        "name": "placeholder-style",
        "description": "Type: string\n需传入对象，格式为 `{ fontSize: number, fontWeight: string, color: string }`\nSince: 1.0.0"
      },
      {
        "name": "selection-end",
        "description": "Type: number\nDefault: -1\nSince: 1.9.0"
      },
      {
        "name": "selection-start",
        "description": "Type: number\nDefault: -1\nSince: 1.9.0"
      },
      {
        "name": "show-confirm-bar",
        "description": "Type: boolean\n是否显示键盘上方带有”完成“按钮那一栏\nDefault: true\nSince: 1.6.0"
      },
      {
        "name": "value",
        "description": "Type: string\nSince: 1.0.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/textarea.html"
      }
    ]
  }
]
