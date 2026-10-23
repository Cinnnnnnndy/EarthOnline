/** 各大洲名胜模型汇总（键与 famous-*.ts 里的 model 对应，全局唯一） */
import type { Maker } from "../landmark-kit.ts";
import { MODELS_ASIA } from "./asia.ts";
import { MODELS_EUROPE } from "./europe.ts";
import { MODELS_AFRICA } from "./africa.ts";
import { MODELS_AMERICAS } from "./americas.ts";
import { MODELS_OCEANIA } from "./oceania.ts";

export const WORLD_MODELS: Record<string, Maker> = { ...MODELS_ASIA, ...MODELS_EUROPE, ...MODELS_AFRICA, ...MODELS_AMERICAS, ...MODELS_OCEANIA };
