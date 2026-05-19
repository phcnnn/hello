from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import random
import hashlib

app = Flask(__name__)
CORS(app)

@app.route('/api/geocode', methods=['GET'])
def geocode():
    address = request.args.get('address')
    if not address:
        return jsonify({'error': 'Address is required'}), 400
    
    url = 'https://nominatim.openstreetmap.org/search'
    params = {
        'q': address,
        'format': 'json',
        'limit': 1
    }
    headers = {'User-Agent': 'SmartNavSystem/1.0'}
    
    try:
        response = requests.get(url, params=params, headers=headers)
        data = response.json()
        if data:
            return jsonify({
                'lat': float(data[0]['lat']),
                'lon': float(data[0]['lon']),
                'display_name': data[0]['display_name']
            })
        else:
            return jsonify({'error': 'Location not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/routes', methods=['GET'])
def get_routes():
    start_lat = request.args.get('start_lat')
    start_lon = request.args.get('start_lon')
    end_lat = request.args.get('end_lat')
    end_lon = request.args.get('end_lon')
    
    if not all([start_lat, start_lon, end_lat, end_lon]):
        return jsonify({'error': 'Start and end coordinates are required'}), 400
        
    # 呼叫 OSRM API 取得步行路線，alternatives=true 代表產生多條備選路線
    url = f"http://router.project-osrm.org/route/v1/foot/{start_lon},{start_lat};{end_lon},{end_lat}"
    params = {
        'alternatives': 'true',
        'geometries': 'geojson',
        'overview': 'full'
    }
    
    try:
        response = requests.get(url, params=params)
        data = response.json()
        if data.get('code') == 'Ok':
            routes = []
            
            # F-03: 為每一條路線模擬不同的環境資料 (AQI, 遮蔭度, 安全度)
            # 在真實系統中，這應該是根據 route['geometry'] 去疊加圖資計算而得
            for i, route in enumerate(data.get('routes', [])):
                
                # 利用 geometry string 產生穩定的亂數 seed，確保同一條路每次產生的分數一樣
                geo_str = str(route['geometry'])
                seed = int(hashlib.md5(geo_str.encode()).hexdigest(), 16) % (10**8)
                random.seed(seed)
                
                # 模擬環境分數
                # AQI: 越低越好 (0-150)
                aqi_score = random.randint(20, 120)
                
                # 遮蔭度: 越高越好 (0-100%)
                shade_score = random.randint(10, 90)
                
                # 安全度(照明/監視器): 越高越好 (0-100分)
                safety_score = random.randint(40, 95)
                
                routes.append({
                    'id': i,
                    'distance_meters': route['distance'],
                    'duration_seconds': route['duration'],
                    'geometry': route['geometry'],
                    'env_data': {
                        'aqi': aqi_score,
                        'shade_percentage': shade_score,
                        'safety_score': safety_score
                    }
                })
            return jsonify({'routes': routes})
        else:
            return jsonify({'error': 'Routes not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
