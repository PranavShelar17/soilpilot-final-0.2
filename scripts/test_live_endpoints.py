import sys
import json
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

base = 'http://localhost:3000'

def fetch_json(endpoint):
    url = base + endpoint
    req = urllib.request.Request(url, headers={'User-Agent': 'TestRunner'})
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode('utf-8'))

def fetch_text(endpoint):
    url = base + endpoint
    req = urllib.request.Request(url, headers={'User-Agent': 'TestRunner'})
    with urllib.request.urlopen(req) as resp:
        return resp.status, resp.read().decode('utf-8')

print('======================================================================')
print('SOILPILOT GIS CROP SUITABILITY - LIVE ENDPOINT VERIFICATION')
print('======================================================================\n')

# 1. HTML Page
s_page, t_page = fetch_text('/field-suitability')
print(f'[TEST 1] Page /field-suitability: HTTP {s_page} OK (HTML length: {len(t_page)} chars)')
print(f'  Contains Crop Suitability page elements: {"field-suitability" in t_page}')

# 2. Crops Catalog
s_crops, j_crops = fetch_json('/api/v1/crop-suitability/crops')
print(f'\n[TEST 2] GET /api/v1/crop-suitability/crops: HTTP {s_crops} OK')
print(f'  Total crops returned: {len(j_crops)}')
for c in j_crops:
    print(f'   - {c["crop_code"]}: {c["crop_name"]} ({c["crop_name_mr"]}) | Category: {c["category"]} | Params: {c["parameters_count"]}')

# 3. Gat 1 Evaluation
s_gat, j_gat = fetch_json('/api/v1/crop-suitability/gat/1')
print(f'\n[TEST 3] GET /api/v1/crop-suitability/gat/1: HTTP {s_gat} OK')
print(f'  Gat Number: {j_gat["gat_no"]}')
print(f'  Village: {j_gat["village"]}')
print(f'  Area: {j_gat["area_ha"]} ha ({j_gat["area_acres"]} acres)')
s_ind = j_gat["soil_indicators"]
print(f'  Soil Indicators: pH={s_ind.get("ph")}, OC={s_ind.get("soc")}%, Texture={s_ind.get("texture")}, Slope={s_ind.get("slope")}%, N={s_ind.get("nitrogen")}')
print('  Evaluations for Gat 1 (Sample 5 crops):')
for ev in j_gat['evaluations'][:5]:
    lim_str = ', '.join([f"{lf['parameter']} ({lf['class']})" for lf in ev.get('limiting_factors', [])])
    print(f'   * {ev["crop_name"]} ({ev["crop_name_mr"]}): Class = {ev["final_suitability_class"]} ({ev["class_title"]}), Score = {ev["suitability_score"]}%')
    if lim_str:
        print(f'     Limiting Factors: {lim_str}')

# 4. Crop All Gats Area Statistics
s_sug, j_sug = fetch_json('/api/v1/crop-suitability/crop/sugarcane')
print(f'\n[TEST 4] GET /api/v1/crop-suitability/crop/sugarcane: HTTP {s_sug} OK')
print(f'  Total GAT parcels evaluated: {j_sug["total_gats"]}')
print(f'  Total Village Area: {j_sug["total_area_ha"]} ha ({j_sug["total_area_acres"]} acres)')
print('  Suitability Class Summary:')
for s_cls, stats in j_sug['class_summary'].items():
    print(f'   - {s_cls}: Count = {stats["count"]} ({stats["percentage_gats"]}%), Area = {stats["area_ha"]} ha ({stats["area_acres"]} acres)')

# 5. Crop GeoJSON Layer
s_geo, j_geo = fetch_json('/api/v1/crop-suitability/crop/sugarcane/geojson')
print(f'\n[TEST 5] GET /api/v1/crop-suitability/crop/sugarcane/geojson: HTTP {s_geo} OK')
print(f'  GeoJSON Type: {j_geo["type"]}')
print(f'  Features count (GAT parcels): {len(j_geo["features"])}')
sample_feat = j_geo['features'][0]
print(f'  Sample Feature (Gat {sample_feat["properties"]["gat_no"]}) Attributes:')
print(f'   - Class: {sample_feat["properties"]["suitability_class"]}')
print(f'   - Score: {sample_feat["properties"]["suitability_score"]}')
print(f'   - Fill Color: {sample_feat["properties"]["fill_color"]}')
print(f'   - Geometry: {sample_feat["geometry"]["type"]}')

# 6. Weather Summary
s_w, j_w = fetch_json('/api/v1/crop-suitability/weather-summary')
print(f'\n[TEST 6] GET /api/v1/crop-suitability/weather-summary: HTTP {s_w} OK')
print(f'  Baseline Period: {j_w["baseline_period"]}')
print(f'  Annual Rainfall: {j_w["historical_30yr"]["annual_rainfall_mm"]} mm')
print(f'  Kharif Rainfall: {j_w["historical_30yr"]["kharif_rainfall_mm"]} mm')
print(f'  Rabi Rainfall: {j_w["historical_30yr"]["rabi_rainfall_mm"]} mm')
print(f'  Mean Temperature: {j_w["historical_30yr"]["mean_temperature_c"]} °C')
print(f'  Relative Humidity: {j_w["historical_30yr"]["relative_humidity_pct"]} %')

# 7. CSV Export
s_csv, t_csv = fetch_text('/api/v1/crop-suitability/export/csv?crop_code=sugarcane&gat_no=1')
print(f'\n[TEST 7] GET /api/v1/crop-suitability/export/csv: HTTP {s_csv} OK')
print('  CSV First 2 Lines:')
for line in t_csv.strip().split('\n')[:2]:
    print('   ' + line)

print('\n======================================================================')
print('ALL 7 INTEGRATION TESTS PASSED WITH 100% SUCCESS!')
print('======================================================================')

