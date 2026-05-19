const map = L.map('map').setView([24.1374, 120.6853], 14);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap'
}).addTo(map);

let currentRouteLayers = [];
let startMarker = null;
let endMarker = null;
let currentRoutesData = [];

const searchBtn = document.getElementById('searchBtn');
const startInput = document.getElementById('start');
const endInput = document.getElementById('end');
const scenarioSelect = document.getElementById('scenario');
const routeCardsContainer = document.getElementById('routeCardsContainer');

// 定義路線顏色
const COLORS = {
  active: '#3b82f6', // 藍色 (推薦/選中)
  inactive: ['#64748b', '#94a3b8', '#cbd5e1'] // 灰色階 (其他)
};

searchBtn.addEventListener('click', async () => {
  const startAddr = startInput.value.trim();
  const endAddr = endInput.value.trim();

  if (!startAddr || !endAddr) {
    alert("請輸入起點與終點");
    return;
  }

  const originalText = searchBtn.innerText;
  searchBtn.innerHTML = '<div class="loader"></div>';
  searchBtn.disabled = true;

  try {
    const startCoords = await fetchGeocode(startAddr);
    const endCoords = await fetchGeocode(endAddr);

    if (!startCoords || !endCoords) {
      throw new Error("無法解析地點，請嘗試輸入更完整的地址");
    }

    updateMarkers(startCoords, endCoords);

    let routes = await fetchRoutes(startCoords, endCoords);
    if (!routes || routes.length === 0) throw new Error("無法規劃路線");

    // F-02: 根據情境模式計算每條路線的加權分數，並排序
    const scenario = scenarioSelect.value;
    routes = evaluateRoutes(routes, scenario);
    currentRoutesData = routes;

    // F-03: 渲染多條路線比較面板
    renderRouteCards(routes);

    // 預設在地圖上高亮第一條(最佳)路線
    drawRoutesOnMap(routes, routes[0].id);

  } catch (error) {
    console.error(error);
    alert(error.message);
  } finally {
    searchBtn.innerText = originalText;
    searchBtn.disabled = false;
  }
});

async function fetchGeocode(address) {
  const res = await fetch(`http://127.0.0.1:5000/api/geocode?address=${encodeURIComponent(address)}`);
  if (!res.ok) return null;
  return await res.json();
}

async function fetchRoutes(start, end) {
  const res = await fetch(`http://127.0.0.1:5000/api/routes?start_lat=${start.lat}&start_lon=${start.lon}&end_lat=${end.lat}&end_lon=${end.lon}`);
  if (!res.ok) throw new Error("路線規劃失敗");
  const data = await res.json();
  return data.routes;
}

function updateMarkers(start, end) {
  if (startMarker) map.removeLayer(startMarker);
  if (endMarker) map.removeLayer(endMarker);

  startMarker = L.marker([start.lat, start.lon]).addTo(map).bindPopup("起點").openPopup();
  endMarker = L.marker([end.lat, end.lon]).addTo(map).bindPopup("終點");

  const bounds = L.latLngBounds([[start.lat, start.lon], [end.lat, end.lon]]);
  map.fitBounds(bounds, { padding: [50, 50] });
}

// F-02: 評估與排序路線
function evaluateRoutes(routes, scenario) {
  routes.forEach(route => {
    let score = 0;
    const { duration_seconds, distance_meters } = route;
    const { aqi, shade_percentage, safety_score } = route.env_data;

    // 分數越高越好
    // 時間基準化：假設最短時間得滿分，時間越長扣越多
    // AQI: 0最佳，越低越好。100以上扣分。

    if (scenario === 'time') {
      score = -duration_seconds; // 時間越短分數越高 (負越少)
    } else if (scenario === 'safety') {
      score = safety_score * 10 - duration_seconds / 60; // 安全優先，但也考慮時間
    } else if (scenario === 'air') {
      score = -aqi * 10 - duration_seconds / 60; // AQI越低越好
    } else if (scenario === 'shade') {
      score = shade_percentage * 10 - duration_seconds / 60; // 遮蔭率越高越好
    }
    route.score = score;
  });

  // 排序：分數高的排前面
  return routes.sort((a, b) => b.score - a.score);
}

// F-03: 繪製比較卡片
function renderRouteCards(routes) {
  routeCardsContainer.innerHTML = '';
  const scenarioLabel = scenarioSelect.options[scenarioSelect.selectedIndex].text.split(' ')[0];

  routes.forEach((route, index) => {
    const { duration_seconds, distance_meters, env_data, id } = route;
    const durationMins = Math.round(duration_seconds / 60);
    const distanceKm = (distance_meters / 1000).toFixed(2);
    
    // 判斷顏色邏輯
    const aqiClass = env_data.aqi <= 50 ? 'good' : (env_data.aqi <= 100 ? 'warn' : 'bad');
    const safetyClass = env_data.safety_score >= 80 ? 'good' : (env_data.safety_score >= 60 ? 'warn' : 'bad');
    const shadeClass = env_data.shade_percentage >= 70 ? 'good' : (env_data.shade_percentage >= 40 ? 'warn' : 'bad');

    const isBest = index === 0;

    const card = document.createElement('div');
    card.className = `route-card ${isBest ? 'active' : ''}`;
    card.onclick = () => {
      // 點擊卡片切換 active 狀態
      document.querySelectorAll('.route-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      drawRoutesOnMap(currentRoutesData, id); // 重新繪製地圖高亮
    };

    card.innerHTML = `
      ${isBest ? `<div class="badge">👑 ${scenarioLabel}推薦</div>` : ''}
      <div class="route-header">
        <div class="route-name">路線 ${index + 1}</div>
        <div class="route-time">${durationMins} min</div>
      </div>
      <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">距離: ${distanceKm} km</div>
      
      <div class="route-metrics">
        <div class="metric">
          <span class="metric-label">空氣品質</span>
          <span class="metric-value ${aqiClass}">AQI ${env_data.aqi}</span>
        </div>
        <div class="metric">
          <span class="metric-label">遮蔭度</span>
          <span class="metric-value ${shadeClass}">${env_data.shade_percentage}%</span>
        </div>
        <div class="metric">
          <span class="metric-label">安全度</span>
          <span class="metric-value ${safetyClass}">${env_data.safety_score}</span>
        </div>
      </div>
    `;

    routeCardsContainer.appendChild(card);
  });
}

function drawRoutesOnMap(routes, activeRouteId) {
  currentRouteLayers.forEach(layer => map.removeLayer(layer));
  currentRouteLayers = [];

  // 將選中的路線放到最後畫，確保它在地圖最上層
  const sortedRoutes = [...routes].sort((a, b) => a.id === activeRouteId ? 1 : -1);

  let inactiveColorIndex = 0;

  sortedRoutes.forEach((route) => {
    const isActive = route.id === activeRouteId;
    const color = isActive ? COLORS.active : COLORS.inactive[inactiveColorIndex % COLORS.inactive.length];
    if (!isActive) inactiveColorIndex++;

    const weight = isActive ? 7 : 4;
    const opacity = isActive ? 1.0 : 0.6;

    const routeLayer = L.geoJSON(route.geometry, {
      style: {
        color: color,
        weight: weight,
        opacity: opacity,
        lineCap: 'round',
        lineJoin: 'round'
      }
    }).addTo(map);

    if (isActive) {
      routeLayer.bringToFront();
    }
    
    currentRouteLayers.push(routeLayer);
  });
}
