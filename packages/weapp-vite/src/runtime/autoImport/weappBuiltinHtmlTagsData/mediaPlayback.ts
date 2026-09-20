// 本文件由 components.weapp.json 自动生成，请勿直接编辑。
/* eslint-disable style/comma-dangle, style/quote-props, style/quotes */

export const WEAPP_BUILTIN_HTML_TAGS_MEDIA_PLAYBACK = [
  {
    "name": "audio",
    "description": "音频。",
    "attributes": [
      {
        "name": "author",
        "description": "Type: string\n默认控件上的作者名字，如果 controls 属性值为 false 则设置 author 无效\nDefault: 未知作者\nSince: 1.0.0"
      },
      {
        "name": "bindended",
        "description": "Type: function => any\n当播放到末尾时触发 ended 事件\nSince: 1.0.0"
      },
      {
        "name": "binderror",
        "description": "Type: function => any\n当发生错误时触发 error 事件，detail = {errMsg:MediaError.code}\nSince: 1.0.0"
      },
      {
        "name": "bindpause",
        "description": "Type: function => any\n当暂停播放时触发 pause 事件\nSince: 1.0.0"
      },
      {
        "name": "bindplay",
        "description": "Type: function => any\n当开始/继续播放时触发play事件\nSince: 1.0.0"
      },
      {
        "name": "bindtimeupdate",
        "description": "Type: function => any\n当播放进度改变时触发 timeupdate 事件，detail = {currentTime, duration}\nSince: 1.0.0"
      },
      {
        "name": "controls",
        "description": "Type: boolean\n是否显示默认控件\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "id",
        "description": "Type: string\naudio 组件的唯一标识符\nSince: 1.0.0"
      },
      {
        "name": "loop",
        "description": "Type: boolean\n是否循环播放\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "name",
        "description": "Type: string\n默认控件上的音频名字，如果 controls 属性值为 false 则设置 name 无效\nDefault: 未知音频\nSince: 1.0.0"
      },
      {
        "name": "poster",
        "description": "Type: string\n默认控件上的音频封面的图片资源地址，如果 controls 属性值为 false 则设置 poster 无效\nSince: 1.0.0"
      },
      {
        "name": "src",
        "description": "Type: string\n要播放音频的资源地址\nSince: 1.0.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/audio.html"
      }
    ]
  },
  {
    "name": "image",
    "description": "图片。支持 JPG、PNG、SVG、WEBP、GIF 等格式，[2.3.0](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html) 起支持云文件ID。\n使用 svg 格式且 mode=scaleToFill 时，WebView 会居中（除非 svg 里加上 preserveAspectRatio=\"none\"），Skyline 则会撑满\nsvg 格式不支持百分比单位\nsvg 格式不支持 <style> element",
    "attributes": [
      {
        "name": "binderror",
        "description": "Type: function => any"
      },
      {
        "name": "bindload",
        "description": "Type: function => any"
      },
      {
        "name": "fade-in",
        "description": "Type: boolean\n是否渐显\nDefault: false"
      },
      {
        "name": "forceHttps",
        "description": "Type: boolean\n自动将 http 链接替换为 https 链接\nDefault: false\nSince: 3.9.1"
      },
      {
        "name": "lazy-load",
        "description": "Type: boolean\n图片懒加载，在即将进入一定范围（上下三屏）时才开始加载。Skyline 默认懒加载。\nDefault: false\nSince: 1.5.0"
      },
      {
        "name": "mode",
        "description": "Type: string\nDefault: scaleToFill",
        "values": [
          {
            "name": "scaleToFill",
            "description": "缩放模式，不保持纵横比缩放图片，使图片的宽高完全拉伸至填满 image 元素"
          },
          {
            "name": "aspectFit",
            "description": "缩放模式，保持纵横比缩放图片，使图片的长边能完全显示出来。也就是说，可以完整地将图片显示出来。"
          },
          {
            "name": "aspectFill",
            "description": "缩放模式，保持纵横比缩放图片，只保证图片的短边能完全显示出来。也就是说，图片通常只在水平或垂直方向是完整的，另一个方向将会发生截取。"
          },
          {
            "name": "widthFix",
            "description": "缩放模式，宽度不变，高度自动变化，保持原图宽高比不变"
          },
          {
            "name": "heightFix",
            "description": "缩放模式，高度不变，宽度自动变化，保持原图宽高比不变"
          },
          {
            "name": "top",
            "description": "裁剪模式，不缩放图片，只显示图片的顶部区域。仅 Webview 支持。"
          },
          {
            "name": "bottom",
            "description": "裁剪模式，不缩放图片，只显示图片的底部区域。仅 Webview 支持。"
          },
          {
            "name": "center",
            "description": "裁剪模式，不缩放图片，只显示图片的中间区域。仅 Webview 支持。"
          },
          {
            "name": "left",
            "description": "裁剪模式，不缩放图片，只显示图片的左边区域。仅 Webview 支持。"
          },
          {
            "name": "right",
            "description": "裁剪模式，不缩放图片，只显示图片的右边区域。仅 Webview 支持。"
          },
          {
            "name": "top left",
            "description": "裁剪模式，不缩放图片，只显示图片的左上边区域。仅 Webview 支持。"
          },
          {
            "name": "top right",
            "description": "裁剪模式，不缩放图片，只显示图片的右上边区域。仅 Webview 支持。"
          },
          {
            "name": "bottom left",
            "description": "裁剪模式，不缩放图片，只显示图片的左下边区域。仅 Webview 支持。"
          },
          {
            "name": "bottom right",
            "description": "裁剪模式，不缩放图片，只显示图片的右下边区域。仅 Webview 支持。"
          }
        ]
      },
      {
        "name": "show-menu-by-longpress",
        "description": "Type: boolean\nDefault: false"
      },
      {
        "name": "src",
        "description": "Type: string"
      },
      {
        "name": "webp",
        "description": "Type: boolean\n默认不解析 webP 格式，只支持网络资源\nDefault: false\nSince: 2.9.0"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/image.html"
      }
    ]
  },
  {
    "name": "video",
    "description": "视频（v2.4.0 起支持[同层渲染](https://developers.weixin.qq.com/miniprogram/dev/component/native-component.html#%E5%8E%9F%E7%94%9F%E7%BB%84%E4%BB%B6%E5%90%8C%E5%B1%82%E6%B8%B2%E6%9F%93)）。",
    "attributes": [
      {
        "name": "ad-unit-id",
        "description": "Type: string\nSince: 2.8.1"
      },
      {
        "name": "auto-pause-if-navigate",
        "description": "Type: boolean\nDefault: true\nSince: 2.5.0"
      },
      {
        "name": "auto-pause-if-open-native",
        "description": "Type: boolean\nDefault: true\nSince: 2.5.0"
      },
      {
        "name": "autoplay",
        "description": "Type: boolean\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "background-poster",
        "description": "Type: string\nSince: 2.14.3"
      },
      {
        "name": "bindcastinginterrupt",
        "description": "Type: function => any\nSince: 2.32.0"
      },
      {
        "name": "bindcastingstatechange",
        "description": "Type: function => any\nSince: 2.32.0"
      },
      {
        "name": "bindcastinguserselect",
        "description": "Type: function => any\nSince: 2.32.0"
      },
      {
        "name": "bindcontrolstoggle",
        "description": "Type: function => any\nSince: 2.9.5"
      },
      {
        "name": "bindended",
        "description": "Type: function => any\nSince: 1.0.0"
      },
      {
        "name": "bindenterpictureinpicture",
        "description": "Type: function => any\nSince: 2.11.0"
      },
      {
        "name": "binderror",
        "description": "Type: function => any\nSince: 1.7.0"
      },
      {
        "name": "bindfullscreenchange",
        "description": "Type: function => any\nSince: 1.4.0"
      },
      {
        "name": "bindleavepictureinpicture",
        "description": "Type: function => any\nSince: 2.11.0"
      },
      {
        "name": "bindloadedmetadata",
        "description": "Type: function => any\nSince: 2.7.0"
      },
      {
        "name": "bindpause",
        "description": "Type: function => any\nSince: 1.0.0"
      },
      {
        "name": "bindplay",
        "description": "Type: function => any\nSince: 1.0.0"
      },
      {
        "name": "bindprogress",
        "description": "Type: function => any\nSince: 2.4.0"
      },
      {
        "name": "bindseekcomplete",
        "description": "Type: function => any\nSince: 2.12.0"
      },
      {
        "name": "bindtimeupdate",
        "description": "Type: function => any\nSince: 1.0.0"
      },
      {
        "name": "bindwaiting",
        "description": "Type: function => any\nSince: 1.7.0"
      },
      {
        "name": "certificate-url",
        "description": "Type: string\nSince: 2.19.3"
      },
      {
        "name": "controls",
        "description": "Type: boolean\nDefault: true\nSince: 1.0.0"
      },
      {
        "name": "danmu-btn",
        "description": "Type: boolean\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "danmu-list",
        "description": "Type: arrayobject\nSince: 1.0.0"
      },
      {
        "name": "direction",
        "description": "Type: number\nSince: 1.7.0",
        "values": [
          {
            "name": "0",
            "description": "正常竖向"
          },
          {
            "name": "90",
            "description": "屏幕逆时针90度"
          },
          {
            "name": "-90",
            "description": "屏幕顺时针90度"
          }
        ]
      },
      {
        "name": "duration",
        "description": "Type: number\nSince: 1.1.0"
      },
      {
        "name": "enable-auto-rotation",
        "description": "Type: boolean\nDefault: false\nSince: 2.11.0"
      },
      {
        "name": "enable-danmu",
        "description": "Type: boolean\nDefault: false\nSince: 1.0.0"
      },
      {
        "name": "enable-play-gesture",
        "description": "Type: boolean\nDefault: false\nSince: 2.4.0"
      },
      {
        "name": "enable-progress-gesture",
        "description": "Type: boolean\nDefault: true\nSince: 1.9.0"
      },
      {
        "name": "initial-time",
        "description": "Type: number\nDefault: 0\nSince: 1.6.0"
      },
      {
        "name": "is-drm",
        "description": "Type: boolean\nSince: 2.19.3"
      },
      {
        "name": "is-live",
        "description": "Type: boolean\nSince: 2.28.1"
      },
      {
        "name": "license-url",
        "description": "Type: string\nSince: 2.19.3"
      },
      {
        "name": "loop",
        "description": "Type: boolean\nDefault: false\nSince: 1.4.0"
      },
      {
        "name": "muted",
        "description": "Type: boolean\nDefault: false\nSince: 1.4.0"
      },
      {
        "name": "object-fit",
        "description": "Type: string\nDefault: contain\nSince: 1.0.0",
        "values": [
          {
            "name": "contain",
            "description": "包含"
          },
          {
            "name": "fill",
            "description": "填充"
          },
          {
            "name": "cover",
            "description": "覆盖"
          }
        ]
      },
      {
        "name": "page-gesture",
        "description": "Type: boolean\nDefault: false\nSince: 1.6.0"
      },
      {
        "name": "picture-in-picture-init-position",
        "description": "Type: string\nSince: 3.3.0"
      },
      {
        "name": "picture-in-picture-mode",
        "description": "Type: string | any[]\nSince: 2.11.0",
        "values": [
          {
            "name": "[]",
            "description": "取消小窗"
          },
          {
            "name": "push",
            "description": "路由 push 时触发小窗"
          },
          {
            "name": "pop",
            "description": "路由 pop 时触发小窗"
          }
        ]
      },
      {
        "name": "picture-in-picture-show-progress",
        "description": "Type: boolean\nDefault: false\nSince: 2.11.0"
      },
      {
        "name": "play-btn-position",
        "description": "Type: string\nDefault: bottom\nSince: 2.4.0",
        "values": [
          {
            "name": "bottom",
            "description": "controls bar上"
          },
          {
            "name": "center",
            "description": "视频中间"
          }
        ]
      },
      {
        "name": "poster",
        "description": "Type: string\nSince: 1.0.0"
      },
      {
        "name": "poster-for-crawler",
        "description": "Type: string"
      },
      {
        "name": "preferred-peak-bit-rate",
        "description": "Type: number\nSince: 2.26.0"
      },
      {
        "name": "provision-url",
        "description": "Type: string\nSince: 2.19.3"
      },
      {
        "name": "referrer-policy",
        "description": "Type: string\nDefault: no-referrer\nSince: 2.13.0",
        "values": [
          {
            "name": "origin",
            "description": "发送完整的referrer"
          },
          {
            "name": "no-referrer",
            "description": "不发送"
          }
        ]
      },
      {
        "name": "show-background-playback-button",
        "description": "Type: boolean\nDefault: true\nSince: 2.14.3"
      },
      {
        "name": "show-bottom-progress",
        "description": "Type: boolean\nDefault: true\nSince: 2.8.0"
      },
      {
        "name": "show-casting-button",
        "description": "Type: boolean\nDefault: false\nSince: 2.10.2"
      },
      {
        "name": "show-center-play-btn",
        "description": "Type: boolean\nDefault: true\nSince: 1.9.0"
      },
      {
        "name": "show-fullscreen-btn",
        "description": "Type: boolean\nDefault: true\nSince: 1.9.0"
      },
      {
        "name": "show-mute-btn",
        "description": "Type: boolean\nDefault: false\nSince: 2.4.0"
      },
      {
        "name": "show-play-btn",
        "description": "Type: boolean\nDefault: true\nSince: 1.9.0"
      },
      {
        "name": "show-progress",
        "description": "Type: boolean\nDefault: true\nSince: 1.9.0"
      },
      {
        "name": "show-screen-lock-button",
        "description": "Type: boolean\nDefault: false\nSince: 2.11.0"
      },
      {
        "name": "show-snapshot-button",
        "description": "Type: boolean\nDefault: false\nSince: 2.13.0"
      },
      {
        "name": "src",
        "description": "Type: string\nSince: 1.0.0"
      },
      {
        "name": "title",
        "description": "Type: string\nSince: 2.4.0"
      },
      {
        "name": "vslide-gesture",
        "description": "Type: boolean\nDefault: false\nSince: 2.6.2"
      },
      {
        "name": "vslide-gesture-in-fullscreen",
        "description": "Type: boolean\nDefault: true\nSince: 2.6.2"
      }
    ],
    "references": [
      {
        "name": "WeChat Mini Program docs",
        "url": "https://developers.weixin.qq.com/miniprogram/dev/component/video.html"
      }
    ]
  }
]
