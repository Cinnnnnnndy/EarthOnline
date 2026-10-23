import { Day, Entry, PlaceTodos, Timeline, TimelineItem, Trip, placesOf } from '../model/Spec';
import { CoreApi } from '../world/CoreApi';
import { I18n } from '../i18n/I18n';
import { Theme } from '../theme/Theme';
import { Tag } from './Controls';
import { groupIcon, iconRes } from './Icons';
import { FONT_BODY, FONT_SUB, TOUCH } from '../gen/Shared';

/** 行程列表里的一行：交通（两站之间一行次要文字）或站点（序号、组图标、名字、待办标签、时间） */
export class ItinRow {
  key: string = '';
  kind: string = 'place';         // place | leg
  entryId: string = '';
  placeIndex: number = 0;         // 站点从 0 数（goto-stop 用）
  name: string = '';
  time: string = '';
  group: string = 'pin';
  visited: boolean = false;
  todoOpen: number = 0;
  sub: string = '';               // 第二行：最近一件待办，或「没有坐标」
}

/** 一天的行程列表的数据：站点之间插交通；时间来自 core('timeline')，待办来自 core('placeTodos')（逐站） */
export class ItinBuilder {
  /** 先给不带时间、待办的一版（立刻能画），再给完整的一版 */
  static quick(day: Day): ItinRow[] { return ItinBuilder.rows(day, null, new Map<string, PlaceTodos>()); }

  static async full(trip: Trip, day: Day, today: string): Promise<ItinRow[]> {
    let tl: Timeline | null = null;
    try { tl = await CoreApi.timeline(day); } catch (e) { tl = null; }
    const todos = new Map<string, PlaceTodos>();
    const places = placesOf(day).filter((e: Entry) => (e.todos ?? []).length > 0);
    const results = await Promise.all(places.map((e: Entry) => CoreApi.placeTodos(e, trip.startDate, today).catch(() => {
      const none: PlaceTodos = { open: 0 };
      return none;
    })));
    for (let i = 0; i < places.length; i++) todos.set(places[i].id, results[i]);
    return ItinBuilder.rows(day, tl, todos);
  }

  private static rows(day: Day, tl: Timeline | null, todos: Map<string, PlaceTodos>): ItinRow[] {
    const out: ItinRow[] = [];
    let pendingMin = 0, pendingMode = '', pendingCount = 0, n = 0;
    const flushLeg = (): void => {
      if (pendingCount === 0) return;
      const r = new ItinRow();
      r.kind = 'leg';
      r.key = 'leg' + out.length;
      r.group = 'g.transit';
      r.name = pendingMin > 0 ? I18n.duration(pendingMin) : I18n.t('mode.' + (pendingMode !== '' ? pendingMode : 'walk'));
      out.push(r);
      pendingMin = 0; pendingMode = ''; pendingCount = 0;
    };
    for (const e of day.entries) {
      if (e.type === 'transport') {
        pendingMin += e.durationMinutes ?? 0;
        if (pendingMode === '') pendingMode = e.mode ?? '';
        pendingCount++;
        continue;
      }
      if (e.type !== 'place') continue;
      flushLeg();
      const r = new ItinRow();
      r.kind = 'place';
      r.key = 'p' + e.id;
      r.entryId = e.id;
      r.placeIndex = n++;
      r.name = e.name ?? '';
      r.group = groupIcon(e.category, e.kind);
      r.visited = e.visited === true;
      if (tl !== null) {
        const it: TimelineItem | undefined = tl.items.find((x: TimelineItem) => x.entryId === e.id);
        if (it !== undefined) r.time = it.start;
      }
      const td = todos.get(e.id);
      if (td !== undefined) {
        r.todoOpen = td.open;
        if (td.next) r.sub = I18n.list([td.next.todo.text, I18n.t1('todo.due', 'date', I18n.monthDay(td.next.due))]);
      }
      if (r.sub === '' && e.geo === undefined) r.sub = I18n.t('home.noCoords');
      out.push(r);
    }
    flushLeg();
    return out;
  }
}

/** 一天的行程列表：从上往下编号（墨底白字的小圆，去过的是晨色），一条细线把序号串起来；点站点 → onTap */
@Component
export struct ItineraryList {
  @Prop rows: ItinRow[] = [];
  /** 列表内容变了就换这个数（让 ForEach 重建行） */
  @Prop rev: number = 0;
  onTap: (r: ItinRow) => void = () => {};
  @State private listH: number = 0;

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      // 串起序号的细线（量出列表的高度再画：在可滚动的父容器里百分比高度没有着落）
      Column()
        .width(2)
        .height(Math.max(0, this.listH - TOUCH))
        .backgroundColor(Theme.p().line)
        .margin({ left: 13, top: TOUCH / 2 })
      Column() {
        ForEach(this.rows, (r: ItinRow) => {
          if (r.kind === 'leg') {
            Row({ space: 12 }) {
              Image(iconRes('g.transit')).width(16).height(16).fillColor(Theme.p().mist).margin({ left: 6, right: 6 })
              Text(r.name).fontSize(FONT_SUB).fontColor(Theme.p().mist).maxLines(1).layoutWeight(1)
            }
            .width('100%')
            .height(28)
          } else {
            Row({ space: 12 }) {
              Text(String(r.placeIndex + 1))
                .fontSize(FONT_SUB)
                .fontWeight(FontWeight.Medium)
                .fontColor(Theme.onInk())
                .textAlign(TextAlign.Center)
                .width(22).height(22)
                .borderRadius(11)
                .backgroundColor(r.visited ? Theme.p().dawn : Theme.p().ink)
                .margin({ left: 3, right: 3 })
              Column({ space: 2 }) {
                Row({ space: 6 }) {
                  Image(iconRes(r.group)).width(14).height(14).fillColor(Theme.p().mist)
                  Text(r.name).fontSize(FONT_BODY).fontColor(Theme.p().ink).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).flexShrink(1)
                  if (r.todoOpen > 0) {
                    Tag({ text: String(r.todoOpen), icon: 'check' })
                  }
                }
                if (r.sub !== '') {
                  Text(r.sub).fontSize(FONT_SUB).fontColor(Theme.p().mist).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
                }
              }
              .layoutWeight(1)
              .alignItems(HorizontalAlign.Start)
              if (r.time !== '') {
                Text(r.time).fontSize(FONT_SUB).fontColor(Theme.p().mist)
              }
            }
            .width('100%')
            .constraintSize({ minHeight: TOUCH })
            .onClick(() => this.onTap(r))
          }
        }, (r: ItinRow) => r.key + '#' + this.rev)
      }
      .width('100%')
      .onAreaChange((_o: Area, n: Area) => { this.listH = n.height as number; })
    }
    .width('100%')
  }
}
