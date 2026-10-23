import osaka from "../../shared/rules/cities/osaka.json";
import kyoto from "../../shared/rules/cities/kyoto.json";
import nara from "../../shared/rules/cities/nara.json";
import kobe from "../../shared/rules/cities/kobe.json";
import { CityPlate, type CityJson } from "../../shared/algo/city.ts";
import { t, type MsgKey } from "../../shared/i18n/index.ts";
export const CITY_JSON: Record<string, CityJson> = { osaka: osaka as unknown as CityJson, kyoto: kyoto as unknown as CityJson, nara: nara as unknown as CityJson, kobe: kobe as unknown as CityJson };
const cache = new Map<string, CityPlate>();
export function plateOf(id: string): CityPlate { let p = cache.get(id); if (!p) { p = new CityPlate(CITY_JSON[id] ?? CITY_JSON.osaka); cache.set(id, p); } return p; }
/** 手画底板的城市（id → 界面语言的名字）；地理切块（"geo"）没有名字，调用方用目的地兜底 */
export const PLATE_CITY_IDS = ["osaka", "kyoto", "nara", "kobe"] as const;
export const cityName = (id: string): string | undefined => ((PLATE_CITY_IDS as readonly string[]).includes(id) ? t(`city.${id}` as MsgKey) : undefined);
