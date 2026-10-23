import { Entry, KindInfo, LEAD_DAYS, MAP_APPS, MapPoint, PlaceTodos, Timeline, TimelineItem, Todo, Trip } from '../model/Spec';
import { AppModel, SheetRoute } from '../model/AppModel';
import { TripStore } from '../model/TripStore';
import { I18n } from '../i18n/I18n';
import { Theme } from '../theme/Theme';
import { CoreApi } from '../world/CoreApi';
import { Field, GlassButton, IconButton, InkButton, NavRow, Tag } from '../components/Controls';
import { categoryKey, groupIcon, iconRes } from '../components/Icons';
import { AppContext, Links } from '../util/Files';
import { FONT_BODY, FONT_SUB, SPACE_S, TOUCH } from '../gen/Shared';

/** 浮层里共用的：按路由找到这一站 */
function findPlace(trips: Trip[], r: SheetRoute): Entry | undefined {
  const t = trips.find((x: Trip) => x.id === r.tripId);
  if (t === undefined || r.dayIndex < 0 || r.dayIndex >= t.days.length) return undefined;
  return t.days[r.dayIndex].entries.find((e: Entry) => e.id === r.entryId && e.type === 'place');
}

function sub(kind: string, from: SheetRoute): SheetRoute {
  const r = new SheetRoute();
  r.kind = kind; r.tripId = from.tripId; r.dayIndex = from.dayIndex; r.entryId = from.entryId;
  return r;
}

/** 站点详情（iOS StopDetailSheet 同一套）：组图标 + 类别标签、名字、计划时间、打卡日期；
 *  待办与备注各占一行入口（点进去是子浮层）；打卡（墨色胶囊，打过卡变「已打卡」）、导航（四家地图任选，链接由 core('mapLink') 出）。 */
@Component
export struct StopDetailSheet {
  @Prop route: SheetRoute = new SheetRoute();
  @StorageLink('eo.trips') @Watch('refresh') trips: Trip[] = [];
  @StorageLink('eo.today') today: string = '';
  @State time: string = '';
  @State todos: PlaceTodos = { open: 0 };
  /** 类型名（core 的 kindInfo，和网页站点行同一套推断）；回来之前先用类别 */
  @State kindLabel: string = '';
  @State famous: boolean = false;

  private app: AppModel = AppModel.shared;

  aboutToAppear(): void { this.refresh(); }

  private has(): boolean { return findPlace(this.trips, this.route) !== undefined; }
  private p(): Entry { return findPlace(this.trips, this.route)!; }
  private trip(): Trip { return this.trips.find((x: Trip) => x.id === this.route.tripId)!; }

  refresh(): void {
    if (!this.has()) return;
    const t = this.trip(), p = this.p(), day = t.days[this.route.dayIndex];
    CoreApi.timeline(day).then((tl: Timeline) => {
      const it: TimelineItem | undefined = tl.items.find((x: TimelineItem) => x.entryId === p.id);
      this.time = it !== undefined ? it.start + ' – ' + it.end : '';
    }).catch(() => { this.time = ''; });
    CoreApi.placeTodos(p, t.startDate, this.today).then((r: PlaceTodos) => { this.todos = r; }).catch(() => { /* 先不显示 */ });
    CoreApi.kindInfo(p, I18n.locale).then((k: KindInfo) => { this.kindLabel = k.label; this.famous = k.famous; }).catch(() => { this.kindLabel = ''; });
  }

  private visited(): boolean { return this.p().visited === true; }

  private todoMeta(): string {
    const n = this.todos.next;
    return n ? I18n.t('todo.next', { 'text': n.todo.text, 'date': I18n.monthDay(n.due) }) : '';
  }

  build() {
    Column({ space: SPACE_S }) {
      if (this.has()) {
        Row({ space: 8 }) {
          Image(iconRes(groupIcon(this.p().category, this.p().kind))).width(18).height(18).fillColor(Theme.p().mist)
          Tag({ text: this.kindLabel !== '' ? this.kindLabel : I18n.t(categoryKey(this.p().category)) })
          if (this.famous) { Tag({ text: I18n.t('home.famous'), live: true }) }
          Blank()
          IconButton({ icon: 'close', label: I18n.t('common.close'), plain: true, action: () => this.app.popSheet() })
        }
        .width('100%')
        Text(this.p().name ?? '').fontSize(FONT_BODY).fontWeight(FontWeight.Medium).fontColor(Theme.p().ink)
        if (this.time !== '') {
          Text(this.time).fontSize(FONT_SUB).fontColor(Theme.p().mist)
        }
        if (this.visited() && this.p().visitedAt !== undefined) {
          Text(I18n.list([I18n.t('day.checkedIn'), I18n.monthDay((this.p().visitedAt ?? '').substring(0, 10))]))
            .fontSize(FONT_SUB).fontColor(Theme.p().dawnInk)
        }
        // 待办与备注各占一行，点进去再看
        Column() {
          Row({ space: 12 }) {
            Image(iconRes('todo')).width(20).height(20).fillColor(Theme.p().mist)
            Column({ space: 2 }) {
              Row({ space: 6 }) {
                Text(I18n.t('todo.title')).fontSize(FONT_BODY).fontColor(Theme.p().ink)
                if (this.todos.open > 0) {
                  Tag({ text: String(this.todos.open), icon: 'check' })
                }
              }
              if (this.todoMeta() !== '') {
                Text(this.todoMeta()).fontSize(FONT_SUB).fontColor(Theme.p().mist).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
              }
            }
            .layoutWeight(1)
            .alignItems(HorizontalAlign.Start)
            Image(iconRes('forward')).width(14).height(14).fillColor(Theme.p().mist2)
          }
          .width('100%')
          .constraintSize({ minHeight: TOUCH })
          .onClick(() => this.app.push(sub('todos', this.route)))
          Row().width('100%').height(0.5).backgroundColor(Theme.p().line).margin({ left: 32 })
          Row({ space: 12 }) {
            Image(iconRes('note')).width(20).height(20).fillColor(Theme.p().mist)
            Text((this.p().notes ?? '') !== '' ? I18n.plain(this.p().notes ?? '') : I18n.t('day.addNote'))
              .fontSize(FONT_BODY)
              .fontColor((this.p().notes ?? '') !== '' ? Theme.p().ink : Theme.p().mist)
              .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
              .layoutWeight(1)
            Image(iconRes('forward')).width(14).height(14).fillColor(Theme.p().mist2)
          }
          .width('100%')
          .constraintSize({ minHeight: TOUCH })
          .onClick(() => this.app.push(sub('notes', this.route)))
        }
        .width('100%')
        Row({ space: 12 }) {
          InkButton({
            title: I18n.t(this.visited() ? 'day.checkedIn' : 'day.checkIn'),
            icon: this.visited() ? 'checkCircle' : 'check',
            action: () => this.app.setVisited(this.route.tripId, this.route.dayIndex, this.route.entryId, !this.visited())
          })
          if (this.p().geo !== undefined) {
            GlassButton({ title: I18n.t('nav.go'), icon: 'navigate', action: () => this.app.push(sub('nav', this.route)) })
          }
        }
        .padding({ top: 8 })
      } else {
        Text(I18n.t('day.notFound')).fontSize(FONT_BODY).fontColor(Theme.p().mist)
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

/** 一个站点的待办：每行勾选、文字（做完的变淡）、到期日标签、删除；最后一行添加（文字 + 提前多久 + 加号，到期日由 core('dueFromLead') 算） */
@Component
export struct TodoSheet {
  @Prop route: SheetRoute = new SheetRoute();
  @StorageLink('eo.trips') trips: Trip[] = [];
  @State text: string = '';
  @State lead: number = 30;

  private app: AppModel = AppModel.shared;
  private store: TripStore = TripStore.shared;

  private has(): boolean { return findPlace(this.trips, this.route) !== undefined; }
  private list(): Todo[] { const p = findPlace(this.trips, this.route); return p !== undefined ? (p.todos ?? []) : []; }
  private dayDate(): string {
    const t = this.trips.find((x: Trip) => x.id === this.route.tripId);
    return t !== undefined && this.route.dayIndex < t.days.length ? t.days[this.route.dayIndex].date : '';
  }

  private add(): void {
    const text = this.text.trim();
    if (text === '') return;
    const r = this.route;
    CoreApi.dueFromLead(this.dayDate(), this.lead).then((due: string) => {
      this.store.addTodo(r.tripId, r.dayIndex, r.entryId, text, due);
    }).catch(() => {
      this.store.addTodo(r.tripId, r.dayIndex, r.entryId, text, this.dayDate());   // 世界层没好：先按那一天
    });
    this.text = '';
  }

  build() {
    Column({ space: 4 }) {
      Row() {
        IconButton({ icon: 'back', label: I18n.t('common.close'), plain: true, action: () => this.app.popSheet() })
        Text(this.list().length > 0 ? I18n.tn('todo.count', this.list().length) : I18n.t('todo.title'))
          .fontSize(FONT_BODY).fontWeight(FontWeight.Medium).fontColor(Theme.p().ink)
      }
      if (this.has()) {
        ForEach(this.list(), (td: Todo) => {
          Row({ space: 6 }) {
            IconButton({
              icon: td.done === true ? 'checkCircle' : 'circle', label: I18n.t('todo.done'), plain: true,
              tint: td.done === true ? Theme.p().dawn : '',
              action: () => this.store.setTodoDone(this.route.tripId, this.route.dayIndex, this.route.entryId, td.id, !(td.done === true))
            })
            Text(td.text)
              .fontSize(FONT_BODY)
              .fontColor(td.done === true ? Theme.p().mist : Theme.p().ink)
              .decoration({ type: td.done === true ? TextDecorationType.LineThrough : TextDecorationType.None })
              .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
              .layoutWeight(1)
            Tag({ text: I18n.t1('todo.due', 'date', I18n.monthDay(td.due ?? this.dayDate())) })
            IconButton({
              icon: 'close', label: I18n.t('todo.remove'), plain: true,
              action: () => this.store.removeTodo(this.route.tripId, this.route.dayIndex, this.route.entryId, td.id)
            })
          }
          .width('100%')
        }, (td: Todo) => td.id + ':' + (td.done === true ? 1 : 0) + ':' + (td.due ?? ''))
        Field({
          placeholder: I18n.t('todo.placeholder'), text: this.text,
          onChange: (v: string) => { this.text = v; }, onSubmit: () => this.add()
        })
        Row({ space: 6 }) {
          ForEach(LEAD_DAYS, (d: number) => {
            Text(I18n.t('todo.lead' + d))
              .fontSize(FONT_SUB)
              .fontColor(d === this.lead ? Theme.onInk() : Theme.p().ink)
              .padding({ left: 10, right: 10 })
              .height(32)
              .borderRadius(16)
              .backgroundColor(d === this.lead ? Theme.p().ink : Theme.p().fill)
              .onClick(() => { this.lead = d; })
          }, (d: number) => d + ':' + (d === this.lead ? 1 : 0))
        }
        .width('100%')
        Row() {
          InkButton({ title: I18n.t('todo.add'), icon: 'plus', enabled: this.text.trim() !== '', action: () => this.add() })
        }
        .width('100%')
        .justifyContent(FlexAlign.End)
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

/** 备注：一个多行输入框，改了就存（TripStore 写盘有去抖） */
@Component
export struct NotesSheet {
  @Prop route: SheetRoute = new SheetRoute();
  @State draft: string = '';
  private app: AppModel = AppModel.shared;

  aboutToAppear(): void {
    const trips = AppStorage.get<Trip[]>('eo.trips') ?? [];
    const p = findPlace(trips, this.route);
    this.draft = p !== undefined ? (p.notes ?? '') : '';
  }

  build() {
    Column({ space: SPACE_S }) {
      Row() {
        IconButton({ icon: 'back', label: I18n.t('common.close'), plain: true, action: () => this.app.popSheet() })
        Text(I18n.t('day.notes')).fontSize(FONT_BODY).fontWeight(FontWeight.Medium).fontColor(Theme.p().ink)
      }
      TextArea({ placeholder: I18n.t('day.notesPlaceholder'), text: this.draft })
        .fontSize(FONT_BODY)
        .fontColor(Theme.p().ink)
        .placeholderColor(Theme.p().mist2)
        .backgroundColor(Theme.p().field)
        .borderRadius(12)
        .constraintSize({ minHeight: 120 })
        .onChange((v: string) => {
          this.draft = v;
          TripStore.shared.setNotes(this.route.tripId, this.route.dayIndex, this.route.entryId, v);
        })
      Row() {
        InkButton({ title: I18n.t('common.done'), action: () => this.app.popSheet() })
      }
      .width('100%')
      .justifyContent(FlexAlign.End)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

/** 用哪个地图导航：四家任选；链接由 core('mapLink') 出（与网页 / iOS 逐字一致），交给系统浏览器（装了 App 会再拉起 App） */
@Component
export struct NavSheet {
  @Prop route: SheetRoute = new SheetRoute();
  private app: AppModel = AppModel.shared;

  private go(mapApp: string): void {
    const trips = AppStorage.get<Trip[]>('eo.trips') ?? [];
    const p = findPlace(trips, this.route);
    const ctx = AppContext.ability;
    if (p === undefined || p.geo === undefined || ctx === null) return;
    // 到这一站的交通方式（前面最近的一条交通）→ 导航方式
    const t = trips.find((x: Trip) => x.id === this.route.tripId)!;
    const entries = t.days[this.route.dayIndex].entries;
    let mode = 'walk';
    for (const e of entries) {
      if (e.id === p.id) break;
      if (e.type === 'transport' && e.mode !== undefined) mode = e.mode;
    }
    const point: MapPoint = { name: p.name ?? '', lat: p.geo.lat, lng: p.geo.lng };
    CoreApi.mapLink(mapApp, point, mode).then((url: string) => Links.open(ctx, url)).catch(() => {
      this.app.toast(I18n.t('day.notFound'));
    });
    this.app.popSheet();
  }

  build() {
    Column() {
      Row() {
        IconButton({ icon: 'back', label: I18n.t('common.close'), plain: true, action: () => this.app.popSheet() })
        Text(I18n.t('nav.title')).fontSize(FONT_BODY).fontWeight(FontWeight.Medium).fontColor(Theme.p().ink)
      }
      ForEach(MAP_APPS, (a: string) => {
        NavRow({ icon: 'navigate', title: I18n.t('nav.' + a), action: () => this.go(a) })
      }, (a: string) => a)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}
