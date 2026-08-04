/* 上升星座計算共用模組（純邏輯，M0.5 技術 Spike 產出，尚未接入任何畫面）。
   跟 moon-sign-calc.js／sun-sign-calc.js 同樣的純模組模式，同時給瀏覽器頁面跟 Node 測試載入。

   重要陷阱記錄（debug 過程中真的踩到，未來維護務必留意）：
   astronomy-engine 有兩組容易混淆的黃道座標框架：
     - ECL：J2000 固定框架（春分點固定在西元 2000 年，不隨時間變動）
     - ECT：當期真黃道框架（春分點隨歲差逐年變動，跟太陽/月亮黃經、占星使用的「回歸黃道」是同一個框架）
   第一版 spike 誤用 Rotation_ECL_HOR（J2000 固定框架）去算上升點，
   結果對到太陽在「真日出瞬間」的黃經時，誤差會隨測試年份離西元 2000 年愈遠而線性變大
  （2026 年誤差約 0.36°，1958 年誤差約 0.58°，正好對應歲差率 50.29″/年 的累積量），
   換成 Rotation_ECT_EQD + Rotation_EQD_HOR（透過 CombineRotation 組合）之後，
   誤差降到 0.003° 左右（約 11 角秒，落在太陽自身黃緯不為 0 跟星曆本身精度範圍內），
   在 1946-2026 全測試範圍內誤差不再隨年份增加，確認框架選對了。
   下面這份模組全程使用 ECT，不要改回 ECL。 */
(function (root) {
  'use strict';

  const SIGNS = [
    { name:'牡羊座', symbol:'♈︎' }, { name:'金牛座', symbol:'♉︎' }, { name:'雙子座', symbol:'♊︎' },
    { name:'巨蟹座', symbol:'♋︎' }, { name:'獅子座', symbol:'♌︎' }, { name:'處女座', symbol:'♍︎' },
    { name:'天秤座', symbol:'♎︎' }, { name:'天蠍座', symbol:'♏︎' }, { name:'射手座', symbol:'♐︎' },
    { name:'摩羯座', symbol:'♑︎' }, { name:'水瓶座', symbol:'♒︎' }, { name:'雙魚座', symbol:'♓︎' }
  ];

  function signIndexFromLongitude(longitude) {
    const normalized = ((longitude % 360) + 360) % 360;
    return Math.floor(normalized / 30);
  }

  /* 需要注入 Astronomy（astronomy-engine 實例），因為這個模組本身不 import 任何東西，
     維持跟 moon-sign-calc.js 一樣「純邏輯、由呼叫端決定怎麼取得 Astronomy」的風格。 */
  function makeAscendantCalc(Astronomy) {
    function ectHorRotation(time, observer) {
      return Astronomy.CombineRotation(
        Astronomy.Rotation_ECT_EQD(time),
        Astronomy.Rotation_EQD_HOR(time, observer)
      );
    }

    function horizonAtEclipticLongitude(rotation, time, lonDeg) {
      const lon = lonDeg * Astronomy.DEG2RAD;
      const vec = new Astronomy.Vector(Math.cos(lon), Math.sin(lon), 0, time);
      const rotated = Astronomy.RotateVector(rotation, vec);
      return Astronomy.HorizonFromVector(rotated, null); // null = 不做大氣折射修正，用真地平（幾何）定義
    }

    /* 黃道（黃緯恆為 0 的大圓）跟地平線（另一個大圓）必交於兩個對蹠點，
       掃描 0-360° 找出高度角變號的位置，二分法精修，再用方位角（東半邊 0-180° 才是上升點）挑出上升點。
       這個找根的方式完全不依賴任何手推的三角公式，只用函式庫本身的旋轉矩陣，用來跟下面的 closed-form 互相驗證。 */
    function ascendantLongitude(time, observer) {
      const rotation = ectHorRotation(time, observer);
      const STEPS = 720; // 每 0.5°
      const samples = [];
      for (let i = 0; i <= STEPS; i++) {
        const lon = (i / STEPS) * 360;
        samples.push([lon, horizonAtEclipticLongitude(rotation, time, lon).lat]);
      }
      const roots = [];
      for (let i = 0; i < STEPS; i++) {
        const [lon0, a0] = samples[i];
        const [lon1, a1] = samples[i + 1];
        if ((a0 <= 0 && a1 > 0) || (a0 >= 0 && a1 < 0)) {
          let lo = lon0, hi = lon1, aLo = a0;
          for (let iter = 0; iter < 40; iter++) {
            const mid = (lo + hi) / 2;
            const aMid = horizonAtEclipticLongitude(rotation, time, mid).lat;
            if ((aLo <= 0 && aMid > 0) || (aLo >= 0 && aMid < 0)) { hi = mid; }
            else { lo = mid; aLo = aMid; }
          }
          roots.push((lo + hi) / 2);
        }
      }
      if (roots.length !== 2) {
        throw new Error(`預期黃道跟地平線恰好交於 2 點，實際找到 ${roots.length} 個（緯度過高地區可能終年不日出/不日落，Taiwan 緯度不會發生這個狀況）`);
      }
      const withAzimuth = roots.map(lon => ({
        lon, az: horizonAtEclipticLongitude(rotation, time, lon).lon
      }));
      const rising = withAzimuth.filter(r => r.az > 0 && r.az < 180);
      if (rising.length !== 1) {
        throw new Error('找不到唯一的上升點（東半邊方位角 0-180°）：' + JSON.stringify(withAzimuth));
      }
      return rising[0].lon;
    }

    /* 獨立對照公式（closed-form，Meeus 天文演算法慣用的上升點公式）。
       跟 ascendantLongitude() 走完全不同的程式路徑（一個是旋轉矩陣數值找根，一個是三角公式解析解），
       只共用 Astronomy 底層星曆，兩者算出來的值在 spike 測試中誤差為 0.0000°，互相驗證通過。
       生產模組保留這個函式只作為回歸測試的獨立對照，不建議取代 ascendantLongitude() 作為主要計算路徑，
       因為找根方式不需要處理象限問題，維護風險更低。 */
    function ascendantLongitudeClosedForm(time, observer) {
      const gstHours = Astronomy.SiderealTime(time);
      const lstHours = gstHours + observer.longitude / 15;
      const ramcDeg = (((lstHours * 15) % 360) + 360) % 360;
      const epsRad = Astronomy.e_tilt(time).tobl * Astronomy.DEG2RAD;
      const phiRad = observer.latitude * Astronomy.DEG2RAD;
      const ramcRad = ramcDeg * Astronomy.DEG2RAD;
      const y = Math.cos(ramcRad);
      const x = -(Math.sin(epsRad) * Math.tan(phiRad) + Math.cos(epsRad) * Math.sin(ramcRad));
      let asc = Math.atan2(y, x) * Astronomy.RAD2DEG;
      return ((asc % 360) + 360) % 360;
    }

    return { ascendantLongitude, ascendantLongitudeClosedForm };
  }

  const AscendantCalc = { SIGNS, signIndexFromLongitude, makeAscendantCalc };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AscendantCalc;
  } else {
    root.AscendantCalc = AscendantCalc;
  }
})(typeof window !== 'undefined' ? window : globalThis);
