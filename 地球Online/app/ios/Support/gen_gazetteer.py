import json
import os
HERE=os.path.dirname(os.path.abspath(__file__))
SRC=os.path.join(HERE, "../../shared/rules/gazetteer.json")
OUT=os.path.join(HERE, "../EarthOnline/Domain/GazetteerData.swift")
N = {
"雷克雅未克":("Reykjavík","レイキャビク"),"维克":("Vík","ヴィーク"),"哥本哈根":("Copenhagen","コペンハーゲン"),"奥斯陆":("Oslo","オスロ"),
"卑尔根":("Bergen","ベルゲン"),"特罗姆瑟":("Tromsø","トロムソ"),"罗弗敦":("Lofoten","ロフォーテン"),"斯德哥尔摩":("Stockholm","ストックホルム"),
"赫尔辛基":("Helsinki","ヘルシンキ"),"罗瓦涅米":("Rovaniemi","ロヴァニエミ"),"东京":("Tokyo","東京"),"京都":("Kyoto","京都"),"大阪":("Osaka","大阪"),
"奈良":("Nara","奈良"),"神户":("Kobe","神戸"),"札幌":("Sapporo","札幌"),"那霸":("Naha","那覇"),"首尔":("Seoul","ソウル"),"台北":("Taipei","台北"),
"香港":("Hong Kong","香港"),"上海":("Shanghai","上海"),"北京":("Beijing","北京"),"成都":("Chengdu","成都"),"西安":("Xi'an","西安"),"拉萨":("Lhasa","ラサ"),
"大理":("Dali","大理"),"丽江":("Lijiang","麗江"),"厦门":("Xiamen","厦門"),"杭州":("Hangzhou","杭州"),"新加坡":("Singapore","シンガポール"),
"曼谷":("Bangkok","バンコク"),"清迈":("Chiang Mai","チェンマイ"),"普吉岛":("Phuket","プーケット"),"巴厘岛":("Bali","バリ島"),"河内":("Hanoi","ハノイ"),
"岘港":("Da Nang","ダナン"),"迪拜":("Dubai","ドバイ"),"伊斯坦布尔":("Istanbul","イスタンブール"),"开罗":("Cairo","カイロ"),"巴黎":("Paris","パリ"),
"伦敦":("London","ロンドン"),"罗马":("Rome","ローマ"),"佛罗伦萨":("Florence","フィレンツェ"),"威尼斯":("Venice","ヴェネツィア"),"巴塞罗那":("Barcelona","バルセロナ"),
"马德里":("Madrid","マドリード"),"里斯本":("Lisbon","リスボン"),"阿姆斯特丹":("Amsterdam","アムステルダム"),"柏林":("Berlin","ベルリン"),"慕尼黑":("Munich","ミュンヘン"),
"布拉格":("Prague","プラハ"),"维也纳":("Vienna","ウィーン"),"布达佩斯":("Budapest","ブダペスト"),"因特拉肯":("Interlaken","インターラーケン"),
"圣托里尼":("Santorini","サントリーニ島"),"纽约":("New York","ニューヨーク"),"旧金山":("San Francisco","サンフランシスコ"),"洛杉矶":("Los Angeles","ロサンゼルス"),
"檀香山":("Honolulu","ホノルル"),"温哥华":("Vancouver","バンクーバー"),"班夫":("Banff","バンフ"),"墨西哥城":("Mexico City","メキシコシティ"),"库斯科":("Cusco","クスコ"),
"悉尼":("Sydney","シドニー"),"墨尔本":("Melbourne","メルボルン"),"皇后镇":("Queenstown","クイーンズタウン"),"开普敦":("Cape Town","ケープタウン"),
"马拉喀什":("Marrakesh","マラケシュ"),"马尔代夫":("Maldives","モルディブ"),"广州":("Guangzhou","広州"),"深圳":("Shenzhen","深圳"),"南京":("Nanjing","南京"),
"苏州":("Suzhou","蘇州"),"武汉":("Wuhan","武漢"),"重庆":("Chongqing","重慶"),"天津":("Tianjin","天津"),"长沙":("Changsha","長沙"),"青岛":("Qingdao","青島"),
"大连":("Dalian","大連"),"沈阳":("Shenyang","瀋陽"),"哈尔滨":("Harbin","ハルビン"),"长春":("Changchun","長春"),"郑州":("Zhengzhou","鄭州"),"济南":("Jinan","済南"),
"合肥":("Hefei","合肥"),"福州":("Fuzhou","福州"),"泉州":("Quanzhou","泉州"),"昆明":("Kunming","昆明"),"贵阳":("Guiyang","貴陽"),"南宁":("Nanning","南寧"),
"桂林":("Guilin","桂林"),"海口":("Haikou","海口"),"三亚":("Sanya","三亜"),"兰州":("Lanzhou","蘭州"),"西宁":("Xining","西寧"),"银川":("Yinchuan","銀川"),
"乌鲁木齐":("Ürümqi","ウルムチ"),"呼和浩特":("Hohhot","フフホト"),"太原":("Taiyuan","太原"),"石家庄":("Shijiazhuang","石家荘"),"南昌":("Nanchang","南昌"),
"宁波":("Ningbo","寧波"),"温州":("Wenzhou","温州"),"绍兴":("Shaoxing","紹興"),"嘉兴":("Jiaxing","嘉興"),"无锡":("Wuxi","無錫"),"常州":("Changzhou","常州"),
"扬州":("Yangzhou","揚州"),"徐州":("Xuzhou","徐州"),"洛阳":("Luoyang","洛陽"),"烟台":("Yantai","煙台"),"珠海":("Zhuhai","珠海"),"东莞":("Dongguan","東莞"),
"佛山":("Foshan","仏山"),"惠州":("Huizhou","恵州"),"澳门":("Macau","マカオ"),"台中":("Taichung","台中"),"高雄":("Kaohsiung","高雄"),"釜山":("Busan","釜山"),
"名古屋":("Nagoya","名古屋"),"福冈":("Fukuoka","福岡"),"吉隆坡":("Kuala Lumpur","クアラルンプール"),"雅加达":("Jakarta","ジャカルタ"),"马尼拉":("Manila","マニラ"),
"胡志明市":("Ho Chi Minh City","ホーチミン"),"孟买":("Mumbai","ムンバイ"),"新德里":("New Delhi","ニューデリー"),"莫斯科":("Moscow","モスクワ"),"多伦多":("Toronto","トロント"),
"芝加哥":("Chicago","シカゴ"),"西雅图":("Seattle","シアトル"),"波士顿":("Boston","ボストン"),"奥克兰":("Auckland","オークランド"),"苏黎世":("Zurich","チューリッヒ"),
"爱丁堡":("Edinburgh","エディンバラ"),"都柏林":("Dublin","ダブリン"),"布鲁塞尔":("Brussels","ブリュッセル"),"华沙":("Warsaw","ワルシャワ"),
}
d=json.load(open(SRC))
def sw(s): return '"' + s.replace('\\','\\\\').replace('"','\\"') + '"'
lines=[]
missing=[]
for p in d:
    en=ja=None
    if p['name'] in N: en,ja=N[p['name']]
    elif p['kind']=='city': missing.append(p['name'])
    al='['+', '.join(sw(a) for a in p['aliases'])+']'
    lines.append(f'        Place(name: {sw(p["name"])}, aliases: {al}, lat: {p["lat"]}, lng: {p["lng"]}, kind: .{p["kind"]}, en: {sw(en) if en else "nil"}, ja: {sw(ja) if ja else "nil"}),')
print('missing', missing)
out = '''import Foundation

// 由 shared/rules/gazetteer.json 生成（另补英文、日文名）。改地名表请改 JSON 后重新生成：
// python3 ios/Support/gen_gazetteer.py
enum GazetteerData {
    static let places: [Place] = [
''' + '\n'.join(lines) + '''
    ]
}
'''
open(OUT,'w').write(out)
print(len(lines))
