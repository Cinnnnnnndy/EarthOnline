import { WorldController } from './WorldController';
import {
  Day, DraftInput, Entry, FootprintsResult, HomePlace, JourneyResult, KindInfo, ManualFlag, MapPoint, Place, PlaceTodos,
  PlanRequest, PlanResult, Quota, Timeline, Trip, TripStats
} from '../model/Spec';

/** 公用的领域核心（shared/core.ts）的类型化门面：鸿蒙壳不移植算法，按名字经桥接调（core-call → core-result）。
 *  参数、返回值都是纯 JSON；返回值按 Spec.ets 里声明的接口取用。名字表见 gen/Shared.ets 的 CORE_FNS。 */
export class CoreApi {
  private static async call(fn: string, args: Object[], locale?: string): Promise<Object> {
    const v = await WorldController.shared.core(fn, args, locale);
    if (v === null) throw new Error('core ' + fn + ': empty');
    return v;
  }

  /** 首页的旅程状态（旅行中 / 快出发 / 刚回来 / 平常日子） */
  static async journey(trips: Trip[], today: string): Promise<JourneyResult> {
    return (await CoreApi.call('journey', [trips, today])) as JourneyResult;
  }

  /** 一本书的统计 */
  static async tripStats(trip: Trip): Promise<TripStats> {
    return (await CoreApi.call('tripStats', [trip])) as TripStats;
  }

  /** 某一天的时间线（每一条的开始 / 结束） */
  static async timeline(day: Day): Promise<Timeline> {
    return (await CoreApi.call('timeline', [day])) as Timeline;
  }

  /** 某一天生成的日记（用户写过的以用户的为准，那是数据里的 day.diary） */
  static async diary(trip: Trip, dayIndex: number, locale: string): Promise<string> {
    return (await CoreApi.call('diary', [trip, dayIndex], locale)) as string;
  }

  /** 一个站点自己的待办：没做完的数量与最近一件 */
  static async placeTodos(entry: Entry, fallbackDue: string, today: string): Promise<PlaceTodos> {
    return (await CoreApi.call('placeTodos', [entry, fallbackDue, today])) as PlaceTodos;
  }

  /** 「提前 n 天」→ 到期日 */
  static async dueFromLead(dayDate: string, lead: number): Promise<string> {
    return (await CoreApi.call('dueFromLead', [dayDate, lead])) as string;
  }

  /** 足迹（去过的地方）与统计；home 没有就不传 */
  static async footprints(trips: Trip[], manual: ManualFlag[], today: string, home: HomePlace | undefined): Promise<FootprintsResult> {
    const args: Object[] = [trips, manual, today];
    if (home !== undefined) args.push(home);
    return (await CoreApi.call('footprints', args)) as FootprintsResult;
  }

  /** 地名搜索（离线小地名表） */
  static async searchPlaces(q: string, limit: number): Promise<Place[]> {
    return (await CoreApi.call('searchPlaces', [q, limit])) as Place[];
  }

  /** 离线规划（说一句话做行程）：与网页、服务端同一套规则 */
  static async plan(req: PlanRequest, locale: string): Promise<PlanResult> {
    return (await CoreApi.call('plan', [req], locale)) as PlanResult;
  }

  /** 由草稿生成一本书 */
  static async buildTrip(input: DraftInput): Promise<Trip> {
    return (await CoreApi.call('buildTrip', [input], input.locale)) as Trip;
  }

  /** 名额（plan 是 'free' | 'pro'；鸿蒙暂时没接付费，一律 free） */
  static async quota(plan: string, trips: Trip[], today: string): Promise<Quota> {
    return (await CoreApi.call('quota', [plan, trips, today])) as Quota;
  }

  /** 导航链接（apple / google / amap / baidu）；mode 是到这一站的交通方式或 walk / drive / transit */
  static async mapLink(app: string, p: MapPoint, mode: string): Promise<string> {
    return (await CoreApi.call('mapLink', [app, p, mode])) as string;
  }

  /** 任意旧版本的行程 JSON → 当前版本（不认识的版本 reject） */
  static async migrate(raw: Object): Promise<Trip> {
    return (await CoreApi.call('migrate', [raw])) as Trip;
  }

  /** 坐标 → 最近的地名（放家、补旗时给个名字）；附近没有就 null */
  static async nearest(lat: number, lng: number): Promise<Place | null> {
    const v = await WorldController.shared.core('nearest', [lat, lng]);
    return v === null ? null : v as Place;
  }

  /** 一个站点的类型（组图标、类型名、名胜与否）：与网页的站点行同一套推断 */
  static async kindInfo(entry: Entry, locale: string): Promise<KindInfo> {
    return (await CoreApi.call('kindInfo', [entry], locale)) as KindInfo;
  }

  /** 天色（day / dusk / night）：外观设置、系统深浅、此刻、家的位置——和网页、iOS 同一套（shared/world/daylight.ts） */
  static async skyPhase(appearance: string, systemDark: boolean, nowIso: string, home: HomePlace | undefined): Promise<string> {
    const args: Object[] = [appearance, systemDark, nowIso];
    if (home !== undefined) args.push(home);
    return (await CoreApi.call('skyPhase', args)) as string;
  }

  /** 校验：返回问题列表（空 = 通过） */
  static async validate(trip: Object): Promise<string[]> {
    return (await CoreApi.call('validate', [trip])) as string[];
  }
}
