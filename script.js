// 初始化地圖 (設定為台中火車站附近)
const map = L.map('map').setView([24.1374, 120.6853], 14);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap'
}).addTo(map);

let currentRouteLayers = [];
let startMarker = null;
let endMarker = null;

// DOM 元素
const searchBtn = document.getElementById('searchBtn');
const startInput = document.getElementById('start');
const endInput = document.getElementById('end');
const infoPanel = document.getElementById('infoPanel');

searchBtn.addEventListener('click', async () => {
  const startAddr = startInput.value.trim();
  const endAddr = endInput.value.trim();

  if (!startAddr || !endAddr) {
    alert("請輸入起點與終點");
    return;
  }

  // 顯示載入中動畫
  searchBtn.innerHTML = '<div class="loader"></div>';
  searchBtn.disabled = true;

  try {
    // 1. 地理編碼 (F-01: 地點轉座標)
    const startCoords = await fetchGeocode(startAddr);
    const endCoords = await fetchGeocode(endAddr);

    if (!startCoords || !endCoords) {
      throw new Error("無法找到指定地點，請嘗試輸入更完整的地址");
    }

    // 標示起點與終點於地圖上
    updateMarkers(startCoords, endCoords);

    // 2. 獲取路線 (F-01: 呼叫 OSRM API 取得路線)
    const routes = await fetchRoutes(startCoords, endCoords);
    if (!routes || routes.length === 0) {
      throw new Error("無法規劃路線");
    }
    
    // 繪製多條路線於地圖上
    drawRoutes(routes);

    // 3. 獲取環境資料 (F-05: 呼叫環境 API)
    // 為了取得代表性資料，我們以路線中心點來獲取環境資料
    const midLat = (startCoords.lat + endCoords.lat) / 2;
    const midLon = (startCoords.lon + endCoords.lon) / 2;
    const envData = await fetchEnvironmentData(midLat, midLon);
    
    // 渲染環境資訊面板 (根據第一條推薦路線的預估時間來顯示)
    renderInfoPanel(envData, routes[0]);

  } catch (error) {
    console.error(error);
    alert("發生錯誤：" + error.message);
  } finally {
    searchBtn.innerHTML = '搜尋路線';
    searchBtn.disabled = false;
  }
});

// 呼叫 Flask 後端 API: Geocoding
async function fetchGeocode(address) {
  const res = await fetch(`http://127.0.0.1:5000/api/geocode?address=${encodeURIComponent(address)}`);
  if (!res.ok) return null;
  return await res.json();
}

// 呼叫 Flask 後端 API: 路線規劃
async function fetchRoutes(start, end) {
  const res = await fetch(`http://127.0.0.1:5000/api/routes?start_lat=${start.lat}&start_lon=${start.lon}&end_lat=${end.lat}&end_lon=${end.lon}`);
  if (!res.ok) throw new Error("路線規劃失敗");
  const data = await res.json();
  return data.routes;
}

// 呼叫 Flask 後端 API: 環境資料
async function fetchEnvironmentData(lat, lon) {
  const res = await fetch(`http://127.0.0.1:5000/api/environment?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error("環境資料獲取失敗");
  return await res.json();
}

// 更新地圖標記 (Start / End Marker)
function updateMarkers(start, end) {
  if (startMarker) map.removeLayer(startMarker);
  if (endMarker) map.removeLayer(endMarker);

  startMarker = L.marker([start.lat, start.lon]).addTo(map).bindPopup("起點").openPopup();
  endMarker = L.marker([end.lat, end.lon]).addTo(map).bindPopup("終點");

  // 自動調整地圖視野以包含起終點
  const bounds = L.latLngBounds([[start.lat, start.lon], [end.lat, end.lon]]);
  map.fitBounds(bounds, { padding: [50, 50] });
}

// 繪製多條路線
function drawRoutes(routes) {
  // 清除舊路線
  currentRouteLayers.forEach(layer => map.removeLayer(layer));
  currentRouteLayers = [];

  // 定義多條路線的顏色配置 (首選藍色，替代路線為綠色、灰色)
  const colors = ['#3b82f6', '#10b981', '#64748b'];

  routes.forEach((route, index) => {
    const geojson = route.geometry;
    const color = colors[index % colors.length];
    // 第一條為主路線，畫粗一點且不透明度高
    const weight = index === 0 ? 7 : 4; 
    const opacity = index === 0 ? 0.9 : 0.6;

    const routeLayer = L.geoJSON(geojson, {
      style: {
        color: color,
        weight: weight,
        opacity: opacity,
        lineCap: 'round',
        lineJoin: 'round'
      }
    }).addTo(map);
    
    currentRouteLayers.push(routeLayer);
  });
}

// 渲染資訊面板 (F-05)
function renderInfoPanel(envData, bestRoute) {
  const durationMins = Math.round(bestRoute.duration_seconds / 60);
  const distanceKm = (bestRoute.distance_meters / 1000).toFixed(2);
  
  let aqiClass = 'aqi-good';
  if (envData.aqi > 50) aqiClass = 'aqi-moderate';
  if (envData.aqi > 100) aqiClass = 'aqi-bad';

  // 使用 Glassmorphism 風格的卡片動態載入資訊
  infoPanel.innerHTML = `
    <div class="info-card">
      <div class="info-icon">🚶</div>
      <div class="info-content">
        <h3>預估步行時間</h3>
        <div class="value">${durationMins} <span style="font-size: 1rem; color: var(--text-muted)">分鐘</span></div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 5px;">總距離: ${distanceKm} km</div>
      </div>
    </div>

    <div class="info-card">
      <div class="info-icon">🍃</div>
      <div class="info-content">
        <h3>沿路空氣品質 (AQI)</h3>
        <div class="value ${aqiClass}">${envData.aqi}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 5px;">狀態: ${envData.air_status}</div>
      </div>
    </div>

    <div class="info-card">
      <div class="info-icon">☀️</div>
      <div class="info-content">
        <h3>即時溫度與日照</h3>
        <div class="value">${envData.temperature}°C</div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 5px;">紫外線指數: ${envData.uv_index}</div>
      </div>
    </div>
  `;
}
