import Foundation

/// 地球外的天色：白天 / 晨昏 / 夜。shared/world/daylight.ts 的逐行移植（同一套 NOAA 简化公式，误差 1° 以内）。
///  1. 设置里选了「白天」或「夜晚」就固定；
///  2. 「跟随手机」：手机是深色外观 → 夜；否则看当地太阳高度（家的经纬度；没设家就按时区推一个经度、纬度 30°），
///     高于 6° 白天，-8°～6° 晨昏，更低是夜。
enum SkyPhase: String, Codable, Sendable { case day, dusk, night }

enum Daylight {
    private static let rad = Double.pi / 180

    /// 太阳高度角（度）。lat / lng 为度，东经为正
    static func sunAltitude(date: Date, lat: Double, lng: Double) -> Double {
        let jd = date.timeIntervalSince1970 / 86_400 + 2_440_587.5
        let n = jd - 2_451_545.0
        let L = (280.46 + 0.9856474 * n).truncatingRemainder(dividingBy: 360)
        let g = (357.528 + 0.9856003 * n).truncatingRemainder(dividingBy: 360) * rad
        let lambda = (L + 1.915 * sin(g) + 0.02 * sin(2 * g)) * rad
        let eps = (23.439 - 0.0000004 * n) * rad
        let dec = asin(sin(eps) * sin(lambda))
        let ra = atan2(cos(eps) * sin(lambda), cos(lambda))
        let gmst = (18.697374558 + 24.06570982441908 * n).truncatingRemainder(dividingBy: 24)   // 格林尼治恒星时（小时）
        let ha = (gmst * 15 + lng) * rad - ra                                                   // 时角
        let alt = asin(sin(lat * rad) * sin(dec) + cos(lat * rad) * cos(dec) * cos(ha))
        return alt / rad
    }

    static func phase(ofAltitude alt: Double) -> SkyPhase {
        alt > 6 ? .day : (alt > -8 ? .dusk : .night)
    }

    /// 没设家时：经度 = 时区偏移 × 15°，纬度 30°N
    static func guessPlace(date: Date, timeZone: TimeZone = .current) -> (lat: Double, lng: Double) {
        (30, Double(timeZone.secondsFromGMT(for: date)) / 60 / 4)
    }

    static func resolvePhase(appearance: Appearance, systemDark: Bool, now: Date,
                             place: (lat: Double, lng: Double)?, timeZone: TimeZone = .current) -> SkyPhase {
        switch appearance {
        case .light: return .day
        case .dark: return .night
        case .auto:
            if systemDark { return .night }
            let p = place ?? guessPlace(date: now, timeZone: timeZone)
            return phase(ofAltitude: sunAltitude(date: now, lat: p.lat, lng: p.lng))
        }
    }
}
