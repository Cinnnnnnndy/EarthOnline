/** 消息频道（D94）：原生壳发给嵌入页的每一种消息，是「状态」还是「一次性动作」。四端（iOS、鸿蒙、安卓、网页调试）一张表。
 *  状态型消息按频道只留最新一条：世界层重载 / 进程被系统回收后，原生按 REPLAY_ORDER 的顺序把每个频道的最新一条重放一遍；
 *  一次性动作（播放、打卡、导入、核心调用……）在世界层还没就绪时排队，就绪后按发出的顺序发一次。
 *  iOS 的 WorldMessages.swift（WorldChannel）就是照这张表写的；鸿蒙、安卓读导出的 bridge.json（tools/export-shared.mjs）。
 *  加一种消息：先在 bridge.ts 加类型，这张表少一项类型检查就会报错。 */
import type { NativeToWorld, ShellToEmbed } from "./bridge.ts";

export const CHANNELS = ["palette", "sky", "post", "avatar", "trips", "home", "footprints", "insets", "layout", "mode", "view", "camera", "pick"] as const;
export type Channel = (typeof CHANNELS)[number];
/** 重放顺序：先外观（色调、天色、画质、角色），再数据（书、家、足迹），再几何（留白、布局），最后是模式与镜头 */
export const REPLAY_ORDER: readonly Channel[] = CHANNELS;

export type MessageKind = NativeToWorld["kind"] | ShellToEmbed["kind"];
/** 每一种消息的频道；null = 一次性动作 */
export const CHANNEL_OF: Record<MessageKind, Channel | null> = {
  // 世界层（NativeToWorld）
  "load-plate": "mode", "goto-stop": null, play: null, pause: null, restart: null,
  "set-avatar": "avatar", "set-view": "view", "set-post": "post", "set-layout": "layout", snapshot: null,
  // 嵌入页（ShellToEmbed）
  "show-globe": "mode", "show-day": "mode", "set-trips": "trips",
  "focus-home": "camera", "focus-book": "camera", "focus-day": "camera", "fly-to": "camera",
  "set-home": "home", "set-footprints": "footprints", "set-insets": "insets", "set-sky": "sky", "set-palette": "palette",
  "mark-visited": null, "pick-point": "pick", "import-page": null,
  "show-suitcase": null, "export-suitcase": null, "case-search": null, "case-toggle": null,
  "core-call": null, "export-long-image": null, "make-card": null,
};
