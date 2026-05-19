document.addEventListener('DOMContentLoaded', () => {
  // 初始化地圖，設定中心點為台中火車站附近
  const map = L.map('map').setView([24.1373, 120.6869], 14);

  // 加入 OpenStreetMap 圖磚
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // 用來存放當前路線和標記的變數
  let currentRoute = null;
  let markers = [];

  const searchBtn = document.getElementById('searchBtn');
  const infoPanel = document.getElementById('infoPanel');

  // 預設提示訊息
  infoPanel.innerHTML = '<p style="color: #aaa; text-align: center; margin: 0;">請輸入起終點並點擊「搜尋路線」</p>';

  searchBtn.addEventListener('click', () => {
    const startInput = document.getElementById('start').value;
    const endInput = document.getElementById('end').value;
    const scenario = document.getElementById('scenario').value;

    if (!startInput || !endInput) {
      alert("請輸入起點與終點！");
      return;
    }

    // 清除舊路線和標記
    if (currentRoute) {
      map.removeLayer(currentRoute);
    }
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    // 根據情境模式設定不同的路線外觀與說明
    let routeColor = '#3388ff';
    let scenarioTitle = '';
    let scenarioDesc = '';
    let mockRouteLatlngs = [];

    // 模擬不同情境下，系統給出的不同推薦路線 (此處為假資料展示)
    if (scenario === 'safety') {
      routeColor = '#ffb703'; // 安全模式 - 溫暖黃色
      scenarioTitle = '安全優先路線';
      scenarioDesc = '避開昏暗巷弄，選擇有路燈及人行道的主要道路，提升夜間行走安全。';
      // 模擬路線座標 (走大馬路)
      mockRouteLatlngs = [
        [24.1373, 120.6869], // 台中火車站
        [24.1360, 120.6850],
        [24.1320, 120.6830],
        [24.1290, 120.6810],
        [24.1230, 120.6780]  // 終點附近
      ];
    } else if (scenario === 'air') {
      routeColor = '#2a9d8f'; // 空氣品質模式 - 清新綠色
      scenarioTitle = '空氣品質優先路線';
      scenarioDesc = '避開交通繁忙路段，選擇 AQI 較低的路線，減少廢氣吸入。';
      // 模擬路線座標 (繞過市區主幹道)
      mockRouteLatlngs = [
        [24.1373, 120.6869],
        [24.1380, 120.6820],
        [24.1350, 120.6750],
        [24.1280, 120.6720],
        [24.1230, 120.6780]
      ];
    } else if (scenario === 'shade') {
      routeColor = '#a2ff00'; // 遮蔭模式 - 亮螢光綠
      scenarioTitle = '遮蔭優先路線';
      scenarioDesc = '選擇騎樓較多或有行道樹遮蔽的路線，減少日照曝曬。';
      // 模擬路線座標 (穿梭有樹蔭的街道)
      mockRouteLatlngs = [
        [24.1373, 120.6869],
        [24.1330, 120.6880],
        [24.1280, 120.6850],
        [24.1250, 120.6810],
        [24.1230, 120.6780]
      ];
    }

    // 加入起終點標記
    const startIcon = L.divIcon({
      className: 'custom-icon start-icon',
      html: '<div style="background-color: #00d2ff; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
    
    const endIcon = L.divIcon({
      className: 'custom-icon end-icon',
      html: '<div style="background-color: #ff0055; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    const startMarker = L.marker(mockRouteLatlngs[0], {icon: startIcon}).addTo(map).bindPopup(`<b>起點：</b> ${startInput}`).openPopup();
    const endMarker = L.marker(mockRouteLatlngs[mockRouteLatlngs.length - 1], {icon: endIcon}).addTo(map).bindPopup(`<b>終點：</b> ${endInput}`);
    markers.push(startMarker, endMarker);

    // 繪製推薦路線 (Polyline)
    currentRoute = L.polyline(mockRouteLatlngs, {
      color: routeColor,
      weight: 6,
      opacity: 0.8,
      smoothFactor: 1,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    // 調整地圖視角以顯示整條路線
    map.fitBounds(currentRoute.getBounds(), { padding: [50, 50], maxZoom: 16 });

    // 更新面板資訊
    // 實務上這裡的距離和時間應由後端或地圖服務 API 計算後回傳
    const mockDistance = (Math.random() * 2 + 1).toFixed(1); // 1.0 ~ 3.0 km
    const mockTime = Math.floor(mockDistance * 12); // 粗估步行時間

    infoPanel.style.borderLeftColor = routeColor;
    infoPanel.innerHTML = `
      <h3 style="color: ${routeColor}; margin-bottom: 12px;">✓ 推薦路線已生成</h3>
      <div style="display: flex; gap: 20px; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 200px;">
          <p><strong>情境模式：</strong> ${scenarioTitle}</p>
          <p style="color: #ccc; font-size: 0.9rem;">${scenarioDesc}</p>
        </div>
        <div style="flex: 1; min-width: 150px; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px;">
          <p style="margin:0 0 8px 0; font-size: 1.5rem; font-weight: bold; color: white;">🚶 ${mockTime} <span style="font-size: 1rem; font-weight: normal; color: #aaa;">分鐘</span></p>
          <p style="margin:0; color: #aaa;">總距離：${mockDistance} 公里</p>
        </div>
      </div>
    `;
  });
});
