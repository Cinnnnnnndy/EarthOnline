import type { TransportMode } from "../spec/types.ts";
import { t, getLocale, type Locale } from "../i18n/index.ts";
// 关键词认中文、英文、日文三种写法（交通标签是用户写的数据，界面语言换了也要认得出）
const RAIL = /(JR|近铁|近鉄|新干线|新幹線|南海|阪急|阪神|京阪|新快速|关空|电车|電車|列车|列車|火车|铁路|鉄道|铁道|线(?!路)|線(?!路)|train|rail|shinkansen)/i;
const SUBWAY = /(地铁|地下铁|地下鉄|metro|subway)/i;
const BUS = /(巴士|公交|公车|バス|bus)/i;
const SHIP = /(船|渡轮|渡船|フェリー|ferry|boat)/i;
const TAXI = /(出租|计程|的士|タクシー|taxi|打车|网约车)/i;
const CAR = /(自驾|租车|开车|驾车|レンタカー|ドライブ|drive|car\b)/i;
const FLIGHT = /(飞机|航班|飛行機|✈|flight|fly)/i;
export function classifyTransport(label: string): TransportMode {
  if (FLIGHT.test(label)) return "flight";
  if (SUBWAY.test(label)) return "subway";
  if (BUS.test(label)) return "bus";
  if (SHIP.test(label)) return "ship";
  if (TAXI.test(label)) return "taxi";
  if (CAR.test(label)) return "car";
  if (RAIL.test(label)) return "rail";
  return "walk";
}
export const MODE_ICON: Record<TransportMode, string> = { walk: "🚶", rail: "🚃", subway: "🚇", bus: "🚌", ship: "⛴", taxi: "🚕", car: "🚗", flight: "✈" };
/** 中文名（数据默认值与旧代码用）；界面上显示用 modeName()，跟当前语言走 */
export const MODE_NAME: Record<TransportMode, string> = { walk: "步行", rail: "铁路", subway: "地铁", bus: "巴士", ship: "船", taxi: "出租车", car: "自驾", flight: "飞机" };
export const modeName = (m: TransportMode, locale: Locale = getLocale()): string => t(`mode.${m}`, undefined, locale);
/** 小人在底板上的速度（格 / 秒）：步行慢、轨道快 */
export const MODE_SPEED: Record<TransportMode, number> = { walk: 1.7, rail: 5.5, subway: 5.0, bus: 3.6, ship: 3.0, taxi: 4.2, car: 4.6, flight: 8 };
/** 乘什么载具（世界层用）：车 / 船 / 飞机 / 无 */
export const MODE_VEHICLE: Record<TransportMode, "car" | "boat" | "plane" | "train" | null> = { walk: null, rail: "train", subway: "train", bus: "car", ship: "boat", taxi: "car", car: "car", flight: "plane" };
