/**
 * @file miniprogram-automator 对外导出入口。
 */
import Automator from './Automator'
import Connection from './Connection'
import Element, { ContextElement, CustomElement, InputElement, MovableViewElement, ScrollViewElement, SliderElement, SwiperElement, SwitchElement, TextareaElement } from './Element'
import Launcher from './Launcher'
import MiniProgram from './MiniProgram'
import Native from './Native'
import Page from './Page'
import Transport from './Transport'

export { Automator, Connection, ContextElement, CustomElement, Element, InputElement, Launcher, MiniProgram, MovableViewElement, Native, Page, ScrollViewElement, SliderElement, SwiperElement, SwitchElement, TextareaElement, Transport }
export * from './Launcher'
export * from './util'
