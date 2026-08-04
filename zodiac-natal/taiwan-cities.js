/* 台灣縣市座標資料（純資料，無 DOM 相依）。M4-A 產出，供上升星座計算使用。
   22 個縣市，座標採用縣市政府所在地的概略座標（非精確門牌），
   精度足夠：M0.5 spike 測過同一時刻台北/台中/高雄/花蓮的上升點差距約 0.89-2.46°，
   縣市政府座標跟縣市內任一點的差距（通常 < 0.3° 經緯度）造成的上升點誤差遠低於這個量級，可以忽略。
   不做全球搜尋／自訂經緯度輸入，僅提供這 22 個選項（對應表單的下拉選單）。 */
(function (root) {
  'use strict';

  const TAIWAN_CITIES = [
    { name: '臺北市', latitude: 25.0375, longitude: 121.5637 },
    { name: '新北市', latitude: 25.0117, longitude: 121.4657 },
    { name: '桃園市', latitude: 24.9937, longitude: 121.3010 },
    { name: '臺中市', latitude: 24.1636, longitude: 120.6478 },
    { name: '臺南市', latitude: 22.9908, longitude: 120.2133 },
    { name: '高雄市', latitude: 22.6273, longitude: 120.3014 },
    { name: '基隆市', latitude: 25.1276, longitude: 121.7392 },
    { name: '新竹市', latitude: 24.8138, longitude: 120.9675 },
    { name: '嘉義市', latitude: 23.4801, longitude: 120.4491 },
    { name: '新竹縣', latitude: 24.8388, longitude: 121.0088 },
    { name: '苗栗縣', latitude: 24.5602, longitude: 120.8214 },
    { name: '彰化縣', latitude: 24.0518, longitude: 120.5161 },
    { name: '南投縣', latitude: 23.9157, longitude: 120.6869 },
    { name: '雲林縣', latitude: 23.7092, longitude: 120.5432 },
    { name: '嘉義縣', latitude: 23.4588, longitude: 120.3358 },
    { name: '屏東縣', latitude: 22.6519, longitude: 120.4858 },
    { name: '宜蘭縣', latitude: 24.7021, longitude: 121.7378 },
    { name: '花蓮縣', latitude: 23.9871, longitude: 121.6015 },
    { name: '臺東縣', latitude: 22.7583, longitude: 121.1444 },
    { name: '澎湖縣', latitude: 23.5711, longitude: 119.5793 },
    { name: '金門縣', latitude: 24.4324, longitude: 118.3171 },
    { name: '連江縣', latitude: 26.1608, longitude: 119.9372 }
  ];

  function findCity(name) {
    return TAIWAN_CITIES.find(c => c.name === name);
  }

  const TaiwanCities = { TAIWAN_CITIES, findCity };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaiwanCities;
  } else {
    root.TaiwanCities = TaiwanCities;
  }
})(typeof window !== 'undefined' ? window : globalThis);
