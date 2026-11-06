"""
MASTER PERFECT SOIL PREDICTION SYSTEM
Digital Soil Mapping (DSM) - Production Inference & Advisory Tool
Study Area: Malegaon Khurd, Baramati, Maharashtra, India

Combines:
  1. Trans-Gaussian Inverse Distance Weighting (IDW)
  2. Geostatistical Ordinary/Universal Kriging
  3. Machine Learning Regressors (Random Forest, Extra Trees, XGBoost, Ridge)
  4. Feature-Enriched Regression Kriging (RK)
  5. Optimal Constrained Convex Ensemble (Stacking Super Learner)

Usage:
  1. CLI:
     python perfect_prediction_system.py --input data.csv --output predictions.csv
     python perfect_prediction_system.py --lat 18.152 --lon 74.580
  2. Python API:
     from perfect_prediction_system import SoilPredictionSystem
     system = SoilPredictionSystem()
     preds_df = system.predict(input_df)
"""

import os
import sys
import argparse
import json
import warnings
import numpy as np
import pandas as pd
from scipy.spatial import cKDTree
import joblib

warnings.filterwarnings("ignore")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if os.path.exists(os.path.join(BASE_DIR, "trained_models")):
    MODELS_DIR = os.path.join(BASE_DIR, "trained_models")
else:
    MODELS_DIR = os.path.join(BASE_DIR, "MASTER_PERFECT_PREDICTION_SYSTEM", "trained_models")

TARGETS = [
    "CaCO3_percent", "Fe_mg_kg", "Cu_mg_kg", "Zn_mg_kg", "K_kg_ha",
    "N_kg_ha", "pH", "OC_percent", "SOM_percent", "Mn_mg_kg",
    "S_kg_ha", "P_kg_ha", "total_carbon_percent", "EC_dS_m", "moisture_bulk_density_g_cm3"
]

TARGET_LABELS = {
    "CaCO3_percent": "Calcium Carbonate CaCO₃ (%)",
    "Fe_mg_kg": "Available Iron Fe (mg/kg)",
    "Cu_mg_kg": "Available Copper Cu (mg/kg)",
    "Zn_mg_kg": "Available Zinc Zn (mg/kg)",
    "K_kg_ha": "Available Potassium K (kg/ha)",
    "N_kg_ha": "Available Nitrogen N (kg/ha)",
    "pH": "Soil pH",
    "OC_percent": "Organic Carbon OC (%)",
    "SOM_percent": "Soil Organic Matter SOM (%)",
    "Mn_mg_kg": "Available Manganese Mn (mg/kg)",
    "S_kg_ha": "Available Sulphur S (kg/ha)",
    "P_kg_ha": "Available Phosphorus P (kg/ha)",
    "total_carbon_percent": "Total Carbon (%)",
    "EC_dS_m": "Electrical Conductivity EC (dS/m)",
    "moisture_bulk_density_g_cm3": "Bulk Density (g/cm³)"
}

UNITS = {
    "CaCO3_percent": "%", "Fe_mg_kg": "mg/kg", "Cu_mg_kg": "mg/kg", "Zn_mg_kg": "mg/kg",
    "K_kg_ha": "kg/ha", "N_kg_ha": "kg/ha", "pH": "pH units", "OC_percent": "%",
    "SOM_percent": "%", "Mn_mg_kg": "mg/kg", "S_kg_ha": "kg/ha", "P_kg_ha": "kg/ha",
    "total_carbon_percent": "%", "EC_dS_m": "dS/m", "moisture_bulk_density_g_cm3": "g/cm³"
}

# Agronomic Soil Health Classification Standards (ICAR / NBSS&LUP)
AGRONOMIC_THRESHOLDS = {
    "CaCO3_percent": [(0, 5, "Non-Calcareous (<5%)"), (5, 15, "Moderately Calcareous (5-15%)"), (15, 100, "Highly Calcareous (>15%)")],
    "Fe_mg_kg": [(0, 4.5, "Deficient (<4.5 mg/kg)"), (4.5, 9.0, "Moderate (4.5-9 mg/kg)"), (9.0, 100, "Sufficient (>9 mg/kg)")],
    "Cu_mg_kg": [(0, 0.2, "Deficient (<0.2 mg/kg)"), (0.2, 0.5, "Moderate (0.2-0.5 mg/kg)"), (0.5, 100, "Sufficient (>0.5 mg/kg)")],
    "Zn_mg_kg": [(0, 0.6, "Deficient (<0.6 mg/kg)"), (0.6, 1.2, "Moderate (0.6-1.2 mg/kg)"), (1.2, 100, "Sufficient (>1.2 mg/kg)")],
    "K_kg_ha": [(0, 140, "Low (<140 kg/ha)"), (140, 280, "Medium (140-280 kg/ha)"), (280, 10000, "High (>280 kg/ha)")],
    "N_kg_ha": [(0, 280, "Low (<280 kg/ha)"), (280, 560, "Medium (280-560 kg/ha)"), (560, 10000, "High (>560 kg/ha)")],
    "pH": [(0, 6.5, "Acidic (<6.5)"), (6.5, 7.8, "Neutral / Optimal (6.5-7.8)"), (7.8, 8.5, "Moderately Alkaline (7.8-8.5)"), (8.5, 14, "Highly Alkaline (>8.5)")],
    "OC_percent": [(0, 0.5, "Low (<0.5%)"), (0.5, 0.75, "Medium (0.5-0.75%)"), (0.75, 100, "High (>0.75%)")],
    "SOM_percent": [(0, 0.86, "Low (<0.86%)"), (0.86, 1.29, "Medium (0.86-1.29%)"), (1.29, 100, "High (>1.29%)")],
    "Mn_mg_kg": [(0, 2.0, "Deficient (<2.0 mg/kg)"), (2.0, 5.0, "Moderate (2.0-5.0 mg/kg)"), (5.0, 100, "Sufficient (>5.0 mg/kg)")],
    "S_kg_ha": [(0, 22.4, "Deficient (<22.4 kg/ha)"), (22.4, 44.8, "Medium (22.4-44.8 kg/ha)"), (44.8, 10000, "Sufficient (>44.8 kg/ha)")],
    "P_kg_ha": [(0, 14, "Low (<14 kg/ha)"), (14, 28, "Medium (14-28 kg/ha)"), (28, 10000, "High (>28 kg/ha)")],
    "total_carbon_percent": [(0, 1.0, "Low (<1.0%)"), (1.0, 1.5, "Medium (1.0-1.5%)"), (1.5, 100, "High (>1.5%)")],
    "EC_dS_m": [(0, 0.8, "Non-Saline (<0.8 dS/m)"), (0.8, 1.6, "Slightly Saline (0.8-1.6 dS/m)"), (1.6, 100, "Saline (>1.6 dS/m)")],
    "moisture_bulk_density_g_cm3": [(0, 1.1, "Low / High Porosity (<1.1 g/cm³)"), (1.1, 1.4, "Ideal Cultivation Density (1.1-1.4 g/cm³)"), (1.4, 3.0, "Compacted Subsoil (>1.4 g/cm³)")],
}

def classify_agronomic_status(target, value):
    thresholds = AGRONOMIC_THRESHOLDS.get(target, [])
    for low, high, label in thresholds:
        if low <= value <= high:
            return label
    return "Standard Range"

def latlon_to_utm(lat, lon):
    # Approximation for UTM Zone 43N around Baramati, Maharashtra (Lat 18.15, Lon 74.58)
    # Using exact WGS84 to UTM 43N conversion
    import math
    a = 6378137.0
    f = 1 / 298.257223563
    e = math.sqrt(2 * f - f * f)
    k0 = 0.9996
    lon0 = 75.0 * math.pi / 180.0
    lat_r = lat * math.pi / 180.0
    lon_r = lon * math.pi / 180.0
    N = a / math.sqrt(1 - (e * math.sin(lat_r))**2)
    T = math.tan(lat_r)**2
    C = (e**2 / (1 - e**2)) * math.cos(lat_r)**2
    A = (lon_r - lon0) * math.cos(lat_r)
    M = a * ((1 - e**2 / 4 - 3 * e**4 / 64 - 5 * e**6 / 256) * lat_r
             - (3 * e**2 / 8 + 3 * e**4 / 32 + 45 * e**6 / 1024) * math.sin(2 * lat_r)
             + (15 * e**4 / 256 + 45 * e**6 / 1024) * math.sin(4 * lat_r)
             - (35 * e**6 / 3072) * math.sin(6 * lat_r))
    x = 500000.0 + k0 * N * (A + (1 - T + C) * A**3 / 6 + (5 - 18 * T + T**2 + 72 * C - 58 * (e**2 / (1 - e**2))) * A**5 / 120)
    y = k0 * (M + N * math.tan(lat_r) * (A**2 / 2 + (5 - T + 9 * C + 4 * C**2) * A**4 / 24 + (61 - 58 * T + T**2 + 600 * C - 330 * (e**2 / (1 - e**2))) * A**6 / 720))
    return x, y

class SoilPredictionSystem:
    def __init__(self, models_dir=None):
        self.models_dir = models_dir or MODELS_DIR
        self.models = {}
        self.load_models()
        
    def load_models(self):
        print(f"Loading Master Prediction Models from: {self.models_dir}")
        for target in TARGETS:
            path = os.path.join(self.models_dir, f"master_perfect_model_{target}.joblib")
            if os.path.exists(path):
                self.models[target] = joblib.load(path)
            else:
                print(f"Warning: Model file not found for target {target}: {path}")
        print(f"Successfully loaded {len(self.models)} target models.")
        
    def _predict_idw_point(self, model_pkg, q_x, q_y):
        tr_x = model_pkg["train_coords_x"]
        tr_y = model_pkg["train_coords_y"]
        tr_z = model_pkg["train_y"]
        p_pow = model_pkg["idw_params"]["power"]
        sm = model_pkg["idw_params"]["smoothing"]
        k = model_pkg["idw_params"]["k"]
        use_log = model_pkg["use_log"]
        shift = model_pkg["min_shift"]
        
        tree = cKDTree(np.column_stack([tr_x, tr_y]))
        dists, idxs = tree.query(np.column_stack([q_x, q_y]), k=min(k, len(tr_z)))
        
        if np.ndim(q_x) == 0 or len(q_x) == 1:
            dists = np.atleast_2d(dists)
            idxs = np.atleast_2d(idxs)
            
        z_work = np.log(tr_z + shift) if use_log else tr_z
        preds = np.zeros(len(q_x))
        for i in range(len(q_x)):
            d = dists[i]
            idx = idxs[i]
            exact = d < 1e-6
            if np.any(exact):
                preds[i] = np.mean(z_work[idx[exact]])
            else:
                w = 1.0 / np.maximum(d + sm, 1e-6)**p_pow
                preds[i] = np.sum(w * z_work[idx]) / np.sum(w)
                
        if use_log:
            return np.exp(preds) - shift
        return preds

    def predict(self, input_data, detailed=True):
        """
        Accepts DataFrame or list of dicts.
        Computes predictions across all 15 targets with individual model breakdowns and confidence intervals.
        """
        if isinstance(input_data, dict):
            df_in = pd.DataFrame([input_data])
        elif isinstance(input_data, list):
            df_in = pd.DataFrame(input_data)
        else:
            df_in = input_data.copy()
            
        N = len(df_in)
        df_out = df_in.copy()
        
        # Ensure coordinates are available
        if 'x_m' not in df_in.columns or 'y_m' not in df_in.columns:
            if 'latitude' in df_in.columns and 'longitude' in df_in.columns:
                coords = [latlon_to_utm(lat, lon) for lat, lon in zip(df_in['latitude'], df_in['longitude'])]
                df_out['x_m'] = [c[0] for c in coords]
                df_out['y_m'] = [c[1] for c in coords]
            else:
                raise ValueError("Input data must contain ('latitude', 'longitude') or ('x_m', 'y_m') columns.")
                
        if 'latitude' not in df_out.columns or 'longitude' not in df_out.columns:
            # Approximate lat lon fallback if only x_m, y_m provided
            df_out['latitude'] = 18.15
            df_out['longitude'] = 74.58
            
        q_x = df_out['x_m'].values
        q_y = df_out['y_m'].values
        
        for target, pkg in self.models.items():
            feats = pkg["features"]
            imputer = pkg["imputer"]
            scaler = pkg["scaler"]
            weights = pkg["weights"]
            w_idw = weights["IDW"]
            w_krg = weights["Kriging"]
            w_ml  = weights["ML"]
            w_rk  = weights["RK"]
            
            # Fill missing covariates with reasonable defaults if missing
            X_raw = pd.DataFrame(index=df_out.index)
            for f in feats:
                if f in df_out.columns:
                    X_raw[f] = df_out[f]
                elif f == 'x_m':
                    X_raw[f] = q_x
                elif f == 'y_m':
                    X_raw[f] = q_y
                elif f == 'latitude':
                    X_raw[f] = df_out['latitude']
                elif f == 'longitude':
                    X_raw[f] = df_out['longitude']
                elif f in ['GIS_NDVI', 'GIS_EVI', 'GIS_SAVI']:
                    X_raw[f] = 0.35
                elif f in ['GIS_NDMI', 'GIS_NDRE', 'GIS_NDWI']:
                    X_raw[f] = 0.15
                elif f == 'GIS_BSI':
                    X_raw[f] = 0.05
                elif f in ['Elevation', 'Slope', 'Aspect']:
                    X_raw[f] = 560.0 if f == 'Elevation' else 1.0
                else:
                    X_raw[f] = 0.0
                    
            X_scaled = scaler.transform(imputer.transform(X_raw[feats].values))
            
            # 1. IDW Prediction
            pred_idw = self._predict_idw_point(pkg, q_x, q_y)
            
            # 2. Kriging Prediction
            ok_model = pkg["kriging_model"]
            try:
                p_k, _ = ok_model.execute('points', q_x, q_y)
                pred_krg = np.nan_to_num(p_k, nan=float(np.mean(pkg["train_y"])))
            except Exception:
                pred_krg = pred_idw.copy()
                
            # 3. ML Prediction
            ml_model = pkg["ml_model"]
            pred_ml = ml_model.predict(X_scaled)
            
            # 4. RK Prediction
            rk_ok = pkg["rk_residual_kriging_model"]
            if rk_ok is not None:
                try:
                    p_res, _ = rk_ok.execute('points', q_x, q_y)
                    pred_rk = pred_ml + np.nan_to_num(p_res, nan=0.0)
                except Exception:
                    pred_rk = pred_ml.copy()
            else:
                pred_rk = pred_ml.copy()
                
            # 5. Combined Prediction (Convex Stacking)
            pred_comb = (
                w_idw * pred_idw +
                w_krg * pred_krg +
                w_ml  * pred_ml +
                w_rk  * pred_rk
            )
            
            # Non-negative clipping for physical concentrations
            if target not in ["moisture_bulk_density_g_cm3"]:
                pred_comb = np.maximum(pred_comb, 0.01)
                
            ci_half = pkg["metrics_summary"].get("CI_95_HalfWidth", 0.1 * np.mean(pred_comb))
            
            # Store main prediction
            df_out[f"{target}_Predicted_{pkg['unit']}"] = np.round(pred_comb, 3)
            df_out[f"{target}_95CI_Lower"] = np.round(np.maximum(0.0, pred_comb - ci_half), 3)
            df_out[f"{target}_95CI_Upper"] = np.round(pred_comb + ci_half, 3)
            df_out[f"{target}_Agronomic_Status"] = [classify_agronomic_status(target, val) for val in pred_comb]
            
            if detailed:
                df_out[f"{target}_SubModel_IDW"] = np.round(pred_idw, 3)
                df_out[f"{target}_SubModel_Kriging"] = np.round(pred_krg, 3)
                df_out[f"{target}_SubModel_ML_{pkg['ml_model_name']}"] = np.round(pred_ml, 3)
                df_out[f"{target}_SubModel_RK"] = np.round(pred_rk, 3)
                
        return df_out

def main():
    parser = argparse.ArgumentParser(description="Master Perfect Digital Soil Mapping Prediction System")
    parser.add_argument("--input", type=str, help="Input CSV path with coordinates and optional covariates")
    parser.add_argument("--output", type=str, default="Predicted_Soil_Properties_Master.csv", help="Output CSV path")
    parser.add_argument("--lat", type=float, help="Latitude for single point prediction")
    parser.add_argument("--lon", type=float, help="Longitude for single point prediction")
    args = parser.parse_args()
    
    system = SoilPredictionSystem()
    
    if args.lat is not None and args.lon is not None:
        print(f"\nComputing predictions for Point: Latitude={args.lat}, Longitude={args.lon}")
        sample = {"latitude": args.lat, "longitude": args.lon}
        res = system.predict(sample, detailed=True)
        print("\n" + "=" * 80)
        print("MASTER COMBINED PREDICTIONS & AGRONOMIC ADVISORY")
        print("=" * 80)
        for t in TARGETS:
            unit = UNITS[t]
            val = res[f"{t}_Predicted_{unit}"].iloc[0]
            ci_lo = res[f"{t}_95CI_Lower"].iloc[0]
            ci_hi = res[f"{t}_95CI_Upper"].iloc[0]
            status = res[f"{t}_Agronomic_Status"].iloc[0]
            print(f"{TARGET_LABELS[t]:32s} : {val:8.3f} {unit:8s} | 95% CI: [{ci_lo:7.2f} - {ci_hi:7.2f}] | {status}")
        print("=" * 80)
        return
        
    input_file = args.input or os.path.join(BASE_DIR, "FINAL_DSM_SCIENTIFICALLY_VALIDATED", "data", "Cleaned_Point_Observations_117.csv")
    print(f"Reading input data from: {input_file}")
    df_in = pd.read_csv(input_file)
    df_res = system.predict(df_in, detailed=True)
    df_res.to_csv(args.output, index=False)
    print(f"\nSuccessfully generated predictions for {len(df_res)} records across all 15 targets.")
    print(f"Saved results to: {args.output}")

if __name__ == "__main__":
    main()
