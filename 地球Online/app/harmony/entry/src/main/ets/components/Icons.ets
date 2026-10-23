/** 图标：resources/base/media/ic_*.svg（全是填充路径，Image.fillColor 才能上色——描边不会被换色）。
 *  $r() 只收字面量，所以按名字查表。行程列表的六组图标见 groupIcon()。 */
export function iconRes(name: string): Resource {
  switch (name) {
    case 'plus': return $r('app.media.ic_plus');
    case 'minus': return $r('app.media.ic_minus');
    case 'close': return $r('app.media.ic_close');
    case 'back': return $r('app.media.ic_back');
    case 'forward': return $r('app.media.ic_forward');
    case 'play': return $r('app.media.ic_play');
    case 'pause': return $r('app.media.ic_pause');
    case 'replay': return $r('app.media.ic_replay');
    case 'follow': return $r('app.media.ic_follow');
    case 'whole': return $r('app.media.ic_whole');
    case 'person': return $r('app.media.ic_person');
    case 'books': return $r('app.media.ic_books');
    case 'import': return $r('app.media.ic_import');
    case 'share': return $r('app.media.ic_share');
    case 'flag': return $r('app.media.ic_flag');
    case 'settings': return $r('app.media.ic_settings');
    case 'book': return $r('app.media.ic_book');
    case 'trash': return $r('app.media.ic_trash');
    case 'edit': return $r('app.media.ic_edit');
    case 'check': return $r('app.media.ic_check');
    case 'checkCircle': return $r('app.media.ic_check_circle');
    case 'circle': return $r('app.media.ic_circle');
    case 'todo': return $r('app.media.ic_todo');
    case 'navigate': return $r('app.media.ic_navigate');
    case 'note': return $r('app.media.ic_note');
    case 'globe': return $r('app.media.ic_globe');
    case 'pin': return $r('app.media.ic_pin');
    case 'home': return $r('app.media.ic_home');
    case 'search': return $r('app.media.ic_search');
    case 'send': return $r('app.media.ic_send');
    case 'sparkle': return $r('app.media.ic_sparkle');
    case 'copy': return $r('app.media.ic_copy');
    case 'calendar': return $r('app.media.ic_calendar');
    case 'g.transit': return $r('app.media.ic_g_transit');
    case 'g.stay': return $r('app.media.ic_g_stay');
    case 'g.culture': return $r('app.media.ic_g_culture');
    case 'g.nature': return $r('app.media.ic_g_nature');
    case 'g.leisure': return $r('app.media.ic_g_leisure');
    case 'g.life': return $r('app.media.ic_g_life');
    default: return $r('app.media.ic_pin');
  }
}

/** 站点的组图标：交通 / 住宿 / 人文 / 自然 / 休闲 / 吃喝购物。
 *  TODO(shared)：类型推断（shared/world/landmark-kinds.ts 的 classify / group）不在 core 里；这里只按条目写明的 kind 与类别分组，
 *  core 加上 kindInfo(entry, locale) → { id, group, name } 后换成它。 */
const CULTURE: string[] = ['mosque', 'temple', 'church', 'castle', 'museum', 'theater', 'ruins', 'monument', 'bridge', 'tower', 'square', 'oldtown'];
const NATURE: string[] = ['geyser', 'hotspring', 'volcano', 'waterfall', 'glacier', 'beach', 'fjord', 'cave', 'lake', 'trail', 'forest', 'mountain'];
const LEISURE: string[] = ['viewpoint', 'cablecar', 'themepark', 'zoo'];

export function groupIcon(category: string | undefined, kind: string | undefined): string {
  const k = kind ?? '';
  if (CULTURE.indexOf(k) >= 0) return 'g.culture';
  if (NATURE.indexOf(k) >= 0) return 'g.nature';
  if (LEISURE.indexOf(k) >= 0) return 'g.leisure';
  if (k === 'market' || k === 'food' || k === 'shop') return 'g.life';
  const c = category ?? 'other';
  if (c === 'station' || c === 'airport' || c === 'port') return 'g.transit';
  if (c === 'hotel') return 'g.stay';
  if (c === 'food' || c === 'shop') return 'g.life';
  if (c === 'sight') return 'g.culture';
  return 'pin';
}

/** 类别的显示名（cat.*；住处用 day.lodging，港口没有单独的键时归「其他」） */
export function categoryKey(category: string | undefined): string {
  const c = category ?? 'other';
  if (c === 'hotel') return 'day.lodging';
  if (c === 'sight' || c === 'food' || c === 'shop' || c === 'station' || c === 'airport') return 'cat.' + c;
  return 'cat.other';
}
