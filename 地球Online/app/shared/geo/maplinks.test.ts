import { test } from "node:test";
import assert from "node:assert/strict";
import { MAP_APPS, mapLink, navMode } from "./maplinks.ts";

const p = { name: "清水寺 Kiyomizu", lat: 34.994856, lng: 135.785046 };

test("导航链接：四家都带坐标与名字，高德 / 百度声明 WGS-84，高德是经度在前", () => {
  for (const app of MAP_APPS) { const u = mapLink(app, p); assert.ok(u.startsWith("https://"), u); if (app !== "google") assert.ok(u.includes(encodeURIComponent(p.name)), u); }   // Google 的导航接口只认坐标
  assert.ok(mapLink("apple", p).includes("daddr=34.994856,135.785046"));
  assert.ok(mapLink("google", p, "transit").includes("travelmode=transit"));
  assert.ok(mapLink("amap", p).includes("to=135.785046,34.994856,") && mapLink("amap", p).includes("coordinate=wgs84"));
  assert.ok(mapLink("baidu", p, "drive").includes("coord_type=wgs84") && mapLink("baidu", p, "drive").includes("mode=driving"));
});

test("导航方式：步行、驾车、其余算公交", () => {
  assert.equal(navMode(undefined), "walk"); assert.equal(navMode("walk"), "walk");
  assert.equal(navMode("car"), "drive"); assert.equal(navMode("taxi"), "drive");
  assert.equal(navMode("subway"), "transit"); assert.equal(navMode("flight"), "transit");
});
