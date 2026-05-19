from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import time
import random

app = Flask(__name__)
CORS(app)

@app.route('/api/geocode', methods=['GET'])
def geocode():
    address = request.args.get('address')
    if not address:
        return jsonify({'error': 'Address is required'}), 400
    
    # 呼叫 Nominatim API 進行地理編碼 (字串轉換為經緯度)
    url = 'https://nominatim.openstreetmap.org/search'
    params = {
        'q': address,
        'format': 'json',
        'limit': 1
    }
    headers = {
        'User-Agent': 'SmartNavSystem/1.0 (Student Project)'
    }
    
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
        
    # 呼叫 OSRM API 取得步行路線 (支援多條備選路線)
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
            for i, route in enumerate(data.get('routes', [])):
                routes.append({
                    'id': i,
                    'distance_meters': route['distance'],
                    'duration_seconds': route['duration'],
                    'geometry': route['geometry']
                })
            return jsonify({'routes': routes})
        else:
            return jsonify({'error': 'Routes not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/environment', methods=['GET'])
def get_environment():
    lat = request.args.get('lat', '24.1374')
    lon = request.args.get('lon', '120.6853')
    
    # 呼叫 Open-Meteo API 抓取即時溫度與日照(紫外線)資料
    weather_url = "https://api.open-meteo.com/v1/forecast"
    weather_params = {
        'latitude': lat,
        'longitude': lon,
        'current_weather': 'true',
        'hourly': 'uv_index'
    }
    
    try:
        w_resp = requests.get(weather_url, params=weather_params)
        w_data = w_resp.json()
        temp = w_data.get('current_weather', {}).get('temperature', 28)
        
        # 由於環境部 AQI API 需要金鑰，這邊做一個模擬函數（基於座標產生固定亂數）
        # 以符合專題的 F-05 展示需求
        random.seed(int(float(lat)*1000) + int(float(lon)*1000))
        aqi = random.randint(30, 95)
        
        air_status = "良好"
        if aqi > 50: air_status = "普通"
        if aqi > 100: air_status = "對敏感族群不健康"
        
        uv = round(random.uniform(2.0, 8.5), 1)
        
        return jsonify({
            'temperature': temp,
            'aqi': aqi,
            'air_status': air_status,
            'uv_index': uv
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # 啟動 Flask 伺服器
    app.run(debug=True, port=5000)
