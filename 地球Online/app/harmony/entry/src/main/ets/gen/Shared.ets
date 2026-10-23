/** 自动生成（tools/export-shared.ts），勿改；改源头（shared/）再跑 npm run export:shared */
export const SCHEMA_VERSION: string = '0.3';
export const AVATAR_FORMS: string[] = ['human', 'fox', 'cat', 'shiba', 'bear', 'rabbit', 'penguin', 'panda', 'duck', 'seal', 'otter', 'capybara', 'bean', 'cloud', 'pebble'];
export const SUITCASE_STYLES: string[] = ['sand', 'ink', 'canvas', 'trunk'];
/** 状态型消息的频道与重放顺序（shared/spec/channels.ts） */
export const REPLAY_ORDER: string[] = ['palette', 'sky', 'post', 'avatar', 'trips', 'home', 'footprints', 'insets', 'layout', 'mode', 'view', 'camera', 'pick'];
export const CHANNEL_OF: Record<string, string> = {
  'load-plate': 'mode',
  'set-avatar': 'avatar',
  'set-view': 'view',
  'set-post': 'post',
  'set-layout': 'layout',
  'show-globe': 'mode',
  'show-day': 'mode',
  'set-trips': 'trips',
  'focus-home': 'camera',
  'focus-book': 'camera',
  'focus-day': 'camera',
  'fly-to': 'camera',
  'set-home': 'home',
  'set-footprints': 'footprints',
  'set-insets': 'insets',
  'set-sky': 'sky',
  'set-palette': 'palette',
  'pick-point': 'pick'
};
/** 领域核心能调的函数（shared/core.ts） */
export const CORE_FNS: string[] = ['journey', 'tripStats', 'timeline', 'diary', 'todos', 'placeTodos', 'dueFromLead', 'footprints', 'searchPlaces', 'locate', 'nearest', 'kindInfo', 'plan', 'buildTrip', 'worldSpec', 'quota', 'canUse', 'aiPlansLeft', 'entitlement', 'mapLink', 'migrate', 'validate', 'skyPhase', 'layout', 't'];
/** 待办「提前几天」的选项（shared/algo/todos.ts）、导航的四家地图（shared/geo/maplinks.ts）、第一次启动装的示例（shared/spec/samples.ts） */
export const LEAD_DAYS: number[] = [30, 14, 7, 1, 0];
export const MAP_APPS: string[] = ['apple', 'google', 'amap', 'baidu'];
export const STARTER_SAMPLES: string[] = ['sample-beijing-classic-4d', 'sample-paris-weekend'];
/** 屏幕形态的阈值（shared/spec/layout.ts） */
export const PHONE_MAX: number = 600;
export const SPREAD_RATIO: number = 0.8;
export const TRIPLE_MIN: number = 1100;
export const TRIPLE_RATIO: number = 1.3;
export const FOLD_GAP: number = 24;
/** 设计令牌（shared/world/tokens.ts）：白天 / 夜里两套，ArkUI 直接收 '#RRGGBB' 与 'rgba(...)' 字符串 */
export class Palette {
  ink: string = '';
  ink2: string = '';
  mist: string = '';
  mist2: string = '';
  line: string = '';
  paper: string = '';
  white: string = '';
  lake: string = '';
  lakeSoft: string = '';
  lakeDeep: string = '';
  dawn: string = '';
  dawnInk: string = '';
  dawnSoft: string = '';
  danger: string = '';
  list: string = '';
  listStrong: string = '';
  fill: string = '';
  press: string = '';
  grab: string = '';
  field: string = '';
  sheet: string = '';
  label: string = '';
  segOn: string = '';
  glassFill: string = ''; glassFillStrong: string = ''; glassRim: string = '';
}
function pal(c: Record<string, string>, s: Record<string, string>, g: Record<string, string>): Palette {
  const p = new Palette();
  p.ink = c['ink'];
  p.ink2 = c['ink2'];
  p.mist = c['mist'];
  p.mist2 = c['mist2'];
  p.line = c['line'];
  p.paper = c['paper'];
  p.white = c['white'];
  p.lake = c['lake'];
  p.lakeSoft = c['lakeSoft'];
  p.lakeDeep = c['lakeDeep'];
  p.dawn = c['dawn'];
  p.dawnInk = c['dawnInk'];
  p.dawnSoft = c['dawnSoft'];
  p.danger = c['danger'];
  p.list = s['list'];
  p.listStrong = s['listStrong'];
  p.fill = s['fill'];
  p.press = s['press'];
  p.grab = s['grab'];
  p.field = s['field'];
  p.sheet = s['sheet'];
  p.label = s['label'];
  p.segOn = s['segOn'];
  p.glassFill = g['fill']; p.glassFillStrong = g['fillStrong']; p.glassRim = g['rim'];
  return p;
}
export const DAY: Palette = pal({"ink":"#1D1E23","ink2":"#45464D","mist":"#5B5C65","mist2":"#A3A4AC","line":"rgba(30,38,64,0.10)","paper":"#F7F8FB","white":"#FFFFFF","lake":"#1D1E23","lakeSoft":"rgba(30,38,64,0.10)","lakeDeep":"#101115","dawn":"#F0B03A","dawnInk":"#754A00","dawnSoft":"rgba(240,176,58,0.18)","danger":"#BE3A52"}, {"list":"rgba(255,255,255,0.62)","listStrong":"rgba(255,255,255,0.75)","fill":"rgba(30,38,64,0.08)","press":"rgba(30,38,64,0.05)","grab":"rgba(30,38,64,0.25)","field":"#FFFFFF","sheet":"rgba(247,248,251,0.9)","label":"rgba(255,255,255,0.8)","segOn":"#FFFFFF"}, {"fill":"rgba(255,255,255,0.46)","fillStrong":"rgba(255,255,255,0.68)","rim":"rgba(255,255,255,0.75)"});
export const NIGHT: Palette = pal({"ink":"#F1F1F4","ink2":"#CACBD1","mist":"#9C9DA5","mist2":"#686971","line":"rgba(255,255,255,0.12)","paper":"#141836","white":"#FFFFFF","lake":"#F1F1F4","lakeSoft":"rgba(255,255,255,0.14)","lakeDeep":"#FFFFFF","dawn":"#F5BE4E","dawnInk":"#F5C766","dawnSoft":"rgba(245,190,78,0.2)","danger":"#F07083"}, {"list":"rgba(255,255,255,0.07)","listStrong":"rgba(255,255,255,0.09)","fill":"rgba(255,255,255,0.12)","press":"rgba(255,255,255,0.06)","grab":"rgba(255,255,255,0.3)","field":"rgba(255,255,255,0.08)","sheet":"rgba(22,26,56,0.9)","label":"rgba(22,26,56,0.72)","segOn":"rgba(255,255,255,0.2)"}, {"fill":"rgba(26,30,64,0.5)","fillStrong":"rgba(22,26,56,0.72)","rim":"rgba(255,255,255,0.34)"});
export const SPACE_BG: Record<string, string> = {"day":"#9cb4f0","dusk":"#6a5a9e","night":"#141a4a"};
/** 「新建旅程」梦幻胶囊的渐变（白天 / 夜里） */
export const DREAM_DAY: string[] = ["#F6D58C","#F0B84A","#E6A032"];
export const DREAM_NIGHT: string[] = ["#EBC25E","#DFA53C","#CF8E2C"];
/** 捏人面板的色块：'#RRGGBB'，下标就是 Avatar 里存的数 */
export const SKIN_COLORS: string[] = ["#F8D2BA","#ECBEA0","#CE9C78","#96684C"];
export const HAIR_COLORS: string[] = ["#422A22","#1E1A1E","#8C5C3A","#CEA062","#683A52"];
export const DRESS_COLORS: string[] = ["#DAA856","#4A5FB0","#EEE8DC","#86A08A","#D48490","#3A4260"];
export const HAT_COLORS: string[] = ["#F2ECE0","#4A5FB0","#E2AC46","#3A4260"];
export const SHOES_COLORS: string[] = ["#70503E","#303240","#ECE6DA","#883E48"];
/** 间距、圆角（vp） */
export const SPACE_S: number = 8; export const SPACE_M: number = 12; export const SPACE_L: number = 16; export const SPACE_XL: number = 24; export const TOUCH: number = 44;
export const RADIUS_S: number = 10; export const RADIUS_M: number = 14; export const RADIUS_L: number = 22; export const RADIUS_SHEET: number = 26;
/** 字号只有两档（fp）：17 与 13；字重 600 / 400 */
export const FONT_BODY: number = 17; export const FONT_SUB: number = 13;
