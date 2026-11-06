"""Soil Health Report Service.
SoilPilot Phase 7
"""
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from app.models.field import Field
from app.models.farmer import Farmer
from app.models.geography import Village, Taluka, District
from app.models.soil_health import SoilReport, SoilParameterValue
from app.services.soil_interpretation import SOIL_THRESHOLDS, interpret_parameter
from app.services.recommendation_engine import (
    get_concise_parameter_recommendation,
    evaluate_parameter_recommendation,
    get_ranked_key_recommendations,
)

# Authoritative Demo Sample Dataset (matching the reference laboratory report & DSM predictions for Baramati Vertisols)
DEMO_LAB_PARAMETERS = [
    # Primary Nutrients & Chemical Metrics
    {"sr_no": 1, "key": "ph", "name": "Soil pH", "name_mr": "मातीचा सामू (pH)", "category": "Chemical", "value": 7.24, "unit": "—", "source": "LAB OBSERVATION"},
    {"sr_no": 2, "key": "ec", "name": "Electrical Conductivity (EC)", "name_mr": "विद्युत वाहकता (EC)", "category": "Chemical", "value": 0.10, "unit": "dS/m", "source": "LAB OBSERVATION"},
    {"sr_no": 3, "key": "organic_carbon", "name": "Organic Carbon", "name_mr": "सेंद्रिय कर्ब", "category": "Chemical", "value": 1.45, "unit": "%", "source": "LAB OBSERVATION"},
    {"sr_no": 4, "key": "som", "name": "Soil Organic Matter (SOM)", "name_mr": "सेंद्रिय पदार्थ (SOM)", "category": "Chemical", "value": 1.05, "unit": "%", "source": "DSM PREDICTION"},
    {"sr_no": 5, "key": "total_carbon", "name": "Total Carbon", "name_mr": "एकूण कर्ब", "category": "Chemical", "value": 1.06, "unit": "%", "source": "DSM PREDICTION"},
    {"sr_no": 6, "key": "available_nitrogen", "name": "Available Nitrogen", "name_mr": "उपलब्ध नत्र (N)", "category": "Primary Nutrient", "value": 179.50, "unit": "kg/ha", "source": "LAB OBSERVATION"},
    {"sr_no": 7, "key": "available_phosphorus", "name": "Available Phosphorus", "name_mr": "उपलब्ध स्फुरद (P)", "category": "Primary Nutrient", "value": 14.51, "unit": "kg/ha", "source": "LAB OBSERVATION"},
    {"sr_no": 8, "key": "available_potassium", "name": "Available Potassium", "name_mr": "उपलब्ध पालाश (K)", "category": "Primary Nutrient", "value": 313.00, "unit": "kg/ha", "source": "LAB OBSERVATION"},
    {"sr_no": 9, "key": "exchangeable_sodium", "name": "Exchangeable Sodium Percentage", "name_mr": "विनिमययोग्य सोडियम (ESP)", "category": "Chemical", "value": 4.50, "unit": "%", "source": "LAB OBSERVATION"},
    {"sr_no": 10, "key": "free_lime", "name": "Free Lime (CaCO3)", "name_mr": "मुक्त चुनखडी (CaCO3)", "category": "Chemical", "value": 8.20, "unit": "%", "source": "LAB OBSERVATION"},
    # Micronutrients & Secondary Nutrients (Indian Research Critical Limits)
    {"sr_no": 11, "key": "iron", "name": "Available Iron (Fe)", "name_mr": "उपलब्ध लोह (Fe)", "category": "Micronutrient", "value": 3.80, "unit": "ppm", "source": "LAB OBSERVATION"},
    {"sr_no": 12, "key": "manganese", "name": "Available Manganese (Mn)", "name_mr": "उपलब्ध मँगनीज (Mn)", "category": "Micronutrient", "value": 4.20, "unit": "ppm", "source": "LAB OBSERVATION"},
    {"sr_no": 13, "key": "zinc", "name": "Available Zinc (Zn)", "name_mr": "उपलब्ध जस्त (Zn)", "category": "Micronutrient", "value": 0.42, "unit": "ppm", "source": "LAB OBSERVATION"},
    {"sr_no": 14, "key": "copper", "name": "Available Copper (Cu)", "name_mr": "उपलब्ध तांबे (Cu)", "category": "Micronutrient", "value": 1.80, "unit": "ppm", "source": "LAB OBSERVATION"},
    {"sr_no": 15, "key": "sulphur", "name": "Available Sulphur (S)", "name_mr": "उपलब्ध गंधक (S)", "category": "Secondary Nutrient", "value": 9.40, "unit": "ppm", "source": "LAB OBSERVATION"},
    {"sr_no": 16, "key": "boron", "name": "Available Boron (B)", "name_mr": "उपलब्ध बोरॉन (B)", "category": "Micronutrient", "value": 0.35, "unit": "ppm", "source": "LAB OBSERVATION"},
    # Physical metric
    {"sr_no": 17, "key": "bd", "name": "Bulk Density", "name_mr": "मातीची घनता (BD)", "category": "Physical", "value": 1.58, "unit": "g/cm³", "source": "LAB OBSERVATION"},
    # DSM Standardized Root-Zone Layers (0-30 cm)
    {"sr_no": 18, "key": "total_nitrogen", "name": "Total Nitrogen", "name_mr": "एकूण नत्र", "category": "Nutrient", "value": 0.14, "unit": "%", "source": "DSM PREDICTION"},
    {"sr_no": 19, "key": "cec", "name": "Cation Exchange Capacity (CEC)", "name_mr": "धनायन विनिमय क्षमता (CEC)", "category": "Chemical", "value": 32.50, "unit": "cmol(c)/kg", "source": "DSM PREDICTION"},
    {"sr_no": 20, "key": "cfvo", "name": "Coarse Fragments", "name_mr": "दगड-गोटे प्रमाण", "category": "Physical", "value": 2.40, "unit": "%", "source": "DSM PREDICTION"},
    {"sr_no": 21, "key": "sand", "name": "Sand", "name_mr": "वाळू / रेती", "category": "Physical", "value": 32.20, "unit": "%", "source": "DSM PREDICTION"},
    {"sr_no": 22, "key": "silt", "name": "Silt", "name_mr": "गाळाचे प्रमाण", "category": "Physical", "value": 29.10, "unit": "%", "source": "DSM PREDICTION"},
    {"sr_no": 23, "key": "clay", "name": "Clay", "name_mr": "चिकणमाती", "category": "Physical", "value": 36.30, "unit": "%", "source": "DSM PREDICTION"},
    {"sr_no": 24, "key": "soil_texture", "name": "Soil Texture Class", "name_mr": "मातीचा पोत वर्ग", "category": "Physical", "value": "Clay Vertisol", "unit": "—", "source": "DSM PREDICTION"},
]

class SoilHealthService:
    @staticmethod
    def _find_field(db: Optional[Session], field_identifier: str) -> Optional[Field]:
        """Resolve field by Gat number, string identifier, or internal integer ID."""
        if db is None:
            return None
        import re
        norm = str(field_identifier).strip()

        # 1. Match Gat number directly in DB (e.g. '12' or '104')
        field = db.query(Field).filter(Field.gat_no == norm).first()
        if field:
            return field

        # 2. Extract digits if e.g. 'gat-12' or 'demo-field-gat-12'
        m = re.search(r"(\d+)", norm)
        if m:
            gat_str = m.group(1)
            field = db.query(Field).filter(Field.gat_no == gat_str).first()
            if field:
                return field

        # 3. Check demo keywords
        if norm.lower() in ["demo-field-gat-104", "demo", "gat-104"]:
            field = db.query(Field).filter(Field.gat_no == "104").first()
            if field:
                return field

        # 4. Fall back to internal integer primary key
        if norm.isdigit():
            field = db.query(Field).filter(Field.id == int(norm)).first()
            if field:
                return field

        return None

    @staticmethod
    def get_report_for_field(
        db: Session,
        field_identifier: str,
        farmer_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        import re
        from app.services.dsm_service import dsm_service
        from app.gis.kml_service import kml_service
        from app.services.soil_model_service import soil_model_service

        field = SoilHealthService._find_field(db, field_identifier)
        norm_id = str(field_identifier).strip().lower()

        # If not found in DB and identifier is clearly unseeded or zeroed UUID
        if not field and ("unseeded" in norm_id or norm_id.startswith("00000000")):
            return {
                "field": {"id": field_identifier, "gat_no": None},
                "farmer": None,
                "has_report": False,
                "is_demo": False,
                "report": None,
                "parameters": [],
                "primary_parameters": {},
            }

        # Extract Gat number
        if field and field.gat_no:
            clean_gat = str(field.gat_no).strip()
        else:
            clean_gat_match = re.search(r"gat-(\d+)", str(field_identifier), re.IGNORECASE)
            if not clean_gat_match:
                clean_gat_match = re.search(r"\b(\d+)\b", str(field_identifier))
            clean_gat = clean_gat_match.group(1) if clean_gat_match else "18"

        display_gat = clean_gat
        # Validate against known KML Gat parcels
        kml_gat = kml_service.get_gat_by_no(clean_gat)
        stats_gat = clean_gat
        if not kml_gat and clean_gat not in ["12", "13", "14", "15", "16", "17", "18", "20", "21", "22", "25"]:
            stats_gat = "18"
            kml_gat = kml_service.get_gat_by_no(stats_gat)

        # Fetch real DSM raster zonal statistics for this specific Gat
        gat_stats = dsm_service.get_gat_stats(stats_gat, db=db)

        is_gat_18 = clean_gat == "18" or display_gat == "18"
        is_gat_22 = clean_gat == "22" or display_gat == "22"

        gat_area = (
            2.69
            if is_gat_18
            else (
                1.49
                if is_gat_22
                else (
                    kml_gat["area_ha"]
                    if kml_gat and kml_gat.get("area_ha")
                    else (gat_stats.get("area_ha") if gat_stats else (field.area if field and field.area else 3.92))
                )
            )
        )
        village_name = (
            "Malegaon Kh."
            if (is_gat_18 or is_gat_22)
            else (
                "Malegaon Bk"
                if display_gat == "104"
                else (
                    kml_gat.get("village")
                    if kml_gat and kml_gat.get("village")
                    else (field.village.name if field and field.village else "Malegaon Kh.")
                )
            )
        )
        taluka_name = "Baramati"
        district_name = "Pune"

        # Master Soil Prediction System integration (15 Targets ML+Kriging Super Learner Ensemble)
        model_pred = soil_model_service.get_or_predict_gat(clean_gat)
        targets = model_pred.get("targets", {})

        # Extract values directly from the built Master Model
        if targets:
            ph_val = targets["pH"]["value"] if "pH" in targets else 7.24
            soc_val = targets["OC_percent"]["value"] if "OC_percent" in targets else 1.45
            som_val = targets["SOM_percent"]["value"] if "SOM_percent" in targets else round(soc_val * 1.724, 2)
            n_val = targets["N_kg_ha"]["value"] if "N_kg_ha" in targets else 179.50
            bd_val = targets["moisture_bulk_density_g_cm3"]["value"] if "moisture_bulk_density_g_cm3" in targets else 1.58
            p_val = targets["P_kg_ha"]["value"] if "P_kg_ha" in targets else 14.51
            k_val = targets["K_kg_ha"]["value"] if "K_kg_ha" in targets else 313.00
            caco3_val = targets["CaCO3_percent"]["value"] if "CaCO3_percent" in targets else 8.20
            fe_val = targets["Fe_mg_kg"]["value"] if "Fe_mg_kg" in targets else 3.80
            cu_val = targets["Cu_mg_kg"]["value"] if "Cu_mg_kg" in targets else 1.80
            zn_val = targets["Zn_mg_kg"]["value"] if "Zn_mg_kg" in targets else 0.42
            mn_val = targets["Mn_mg_kg"]["value"] if "Mn_mg_kg" in targets else 4.20
            s_val = targets["S_kg_ha"]["value"] if "S_kg_ha" in targets else 9.40
            ec_val = targets["EC_dS_m"]["value"] if "EC_dS_m" in targets else 0.10
            total_carbon_val = targets["total_carbon_percent"]["value"] if "total_carbon_percent" in targets else round(soc_val * 1.15, 2)
        else:
            ph_val = 7.24
            soc_val = 1.45
            som_val = 1.05
            n_val = 179.50
            bd_val = 1.58
            p_val = 14.51
            k_val = 313.00
            caco3_val = 8.20
            fe_val = 3.80
            cu_val = 1.80
            zn_val = 0.42
            mn_val = 4.20
            s_val = 9.40
            ec_val = 0.10
            total_carbon_val = 1.06

        total_n_val = round(n_val * 0.0008, 2) if n_val else 0.14
        cec_val = 32.50
        cfvo_val = 2.40
        sand_val = 32.20
        silt_val = 29.10
        clay_val = 36.30
        texture_val = "Clay Vertisol"

        params = []
        for p in DEMO_LAB_PARAMETERS:
            val = p["value"]
            src = "DSM PREDICTION"
            k = p["key"]

            if k == "ph":
                val = ph_val
            elif k == "ec":
                val = ec_val
            elif k == "organic_carbon":
                val = soc_val
            elif k in ["som", "soil_organic_matter"]:
                val = som_val
            elif k in ["total_carbon"]:
                val = total_carbon_val
            elif k in ["available_nitrogen", "nitrogen"]:
                val = n_val
            elif k in ["available_phosphorus", "phosphorus", "p"]:
                val = p_val
            elif k in ["available_potassium", "potassium", "k"]:
                val = k_val
            elif k in ["free_lime", "caco3"]:
                val = caco3_val
            elif k in ["iron", "fe"]:
                val = fe_val
            elif k in ["copper", "cu"]:
                val = cu_val
            elif k in ["zinc", "zn"]:
                val = zn_val
            elif k in ["manganese", "mn"]:
                val = mn_val
            elif k in ["sulphur", "s"]:
                val = s_val
            elif k == "bd":
                val = bd_val
            elif k == "total_nitrogen":
                val = total_n_val
                src = "DSM PREDICTION"
            elif k == "cec":
                val = cec_val
                src = "DSM PREDICTION"
            elif k == "cfvo":
                val = cfvo_val
                src = "DSM PREDICTION"
            elif k == "sand":
                val = sand_val
                src = "DSM PREDICTION"
            elif k == "silt":
                val = silt_val
                src = "DSM PREDICTION"
            elif k == "clay":
                val = clay_val
                src = "DSM PREDICTION"
            elif k == "soil_texture":
                val = texture_val
                src = "DSM PREDICTION"
            else:
                src = p["source"]

            interp_en, interp_mr, ref_range = interpret_parameter(p["key"], val)
            ref_range_mr = SOIL_THRESHOLDS.get(p["key"], {}).get("reference_range_mr", ref_range)
            rec_info = get_concise_parameter_recommendation(p["key"], val, interp_en, interp_mr)
            detailed_rec = evaluate_parameter_recommendation(
                key=p["key"],
                name=p["name"],
                name_mr=p["name_mr"],
                category=p["category"],
                value=val,
                unit=p["unit"],
                interpretation_en=interp_en,
                interpretation_mr=interp_mr,
                source=src,
            )
            detail_guidance = detailed_rec.get("action_guidance", "") if detailed_rec else ""
            detail_guidance_mr = detailed_rec.get("action_guidance_mr", "") if detailed_rec else ""

            params.append({
                "sr_no": p["sr_no"],
                "key": p["key"],
                "parameter_key": p["key"],
                "name": p["name"],
                "parameter_name": p["name"],
                "name_mr": p["name_mr"],
                "parameter_name_mr": p["name_mr"],
                "category": p["category"],
                "value": val,
                "unit": p["unit"],
                "interpretation": interp_en,
                "interpretation_en": interp_en,
                "interpretation_mr": interp_mr,
                "reference_range": ref_range,
                "reference_range_mr": ref_range_mr,
                "recommendation": rec_info["recommendation"],
                "recommendation_mr": rec_info["recommendation_mr"],
                "status_category": rec_info["status_category"],
                "priority_rank": rec_info["priority_rank"],
                "priority_key": rec_info["priority_key"],
                "recommendation_detail": detail_guidance,
                "recommendation_detail_mr": detail_guidance_mr,
                "source": src,
                "source_type": src,
            })

        # Dynamic Key Recommendations Summary (ranked internally: Critical > Low > High > Medium > Optimal)
        key_recs = get_ranked_key_recommendations(params, max_items=5)

        ph_interp, ph_interp_mr, _ = interpret_parameter("ph", ph_val)
        ec_interp, ec_interp_mr, _ = interpret_parameter("ec", ec_val)
        oc_interp, oc_interp_mr, _ = interpret_parameter("organic_carbon", soc_val)
        n_interp, n_interp_mr, _ = interpret_parameter("available_nitrogen", n_val)
        p_interp, p_interp_mr, _ = interpret_parameter("available_phosphorus", p_val)
        k_interp, k_interp_mr, _ = interpret_parameter("available_potassium", k_val)
        fe_interp, fe_interp_mr, _ = interpret_parameter("iron", fe_val)
        zn_interp, zn_interp_mr, _ = interpret_parameter("zinc", zn_val)
        caco3_interp, caco3_interp_mr, _ = interpret_parameter("free_lime", caco3_val)
        bd_interp, bd_interp_mr, _ = interpret_parameter("bd", bd_val)

        dynamic_observations = [
            f"Soil reaction (pH {ph_val:.2f}) indicates {ph_interp} condition. Monitor Fe, Zn and micronutrient availability accordingly.",
            f"Electrical conductivity ({ec_val:.2f} dS/m) is {ec_interp}; maintain appropriate irrigation and drainage.",
            f"Organic carbon ({soc_val}%) status is {oc_interp}; maintain organic matter through crop residue recycling.",
            f"Available nitrogen is {n_interp} ({n_val} kg/ha); adjust nitrogen fertilizer applications in split doses based on crop RDF.",
            f"Available phosphorus ({p_val:.2f} kg/ha) status is {p_interp}; apply balanced P fertilizers according to crop requirements.",
            f"Available potassium ({k_val:.2f} kg/ha) status is {k_interp}; optimize potash application to prevent nutrient imbalance.",
            f"Available iron ({fe_val:.2f} ppm) status is {fe_interp}; implement crop-specific Fe management if required.",
            f"Available zinc ({zn_val:.2f} ppm) status is {zn_interp}; apply zinc sulphate as basal or foliar dose if needed.",
            f"Free lime / CaCO3 ({caco3_val:.2f}%) status is {caco3_interp}.",
            f"Bulk density ({bd_val:.3f} g/cm³) is {bd_interp} for vertisols."
        ]

        dynamic_observations_mr = [
            f"मातीची प्रतिक्रिया (pH {ph_val:.2f}) {ph_interp_mr} स्थिती दर्शवते. त्यानुसार सूक्ष्म अन्नद्रव्यांची उपलब्धता तपासावी.",
            f"विद्युत वाहकता ({ec_val:.2f} dS/m) {ec_interp_mr} आहे; योग्य सिंचन व निचरा व्यवस्था ठेवावी.",
            f"सेंद्रिय कर्ब ({soc_val}%) {oc_interp_mr} आहे; पिकांचे अवशेष जमिनीत मिसळून सेंद्रिय कर्ब टिकवून ठेवावा.",
            f"उपलब्ध नत्र {n_interp_mr} ({n_val} kg/ha) आहे; शिफारशीत मात्रेनुसार नत्र खतांचा वापर हप्त्यांमध्ये करावा.",
            f"उपलब्ध स्फुरद ({p_val:.2f} kg/ha) {p_interp_mr} आहे; पिकाच्या गरजेनुसार संतुलित स्फुरद खते द्यावीत.",
            f"उपलब्ध पालाश ({k_val:.2f} kg/ha) {k_interp_mr} आहे; पालाश खतांची मात्रा गरजेनुसार नियंत्रित ठेवावी.",
            f"उपलब्ध लोह ({fe_val:.2f} ppm) {fe_interp_mr} आहे; आवश्यकतेनुसार लोह खतांचा वापर करावा.",
            f"उपलब्ध जस्त ({zn_val:.2f} ppm) {zn_interp_mr} आहे; गरजेनुसार झिंक सल्फेटचा वापर करावा.",
            f"मुक्त चुनखडी / CaCO3 ({caco3_val:.2f}%) {caco3_interp_mr} आहे.",
            f"मातीची घनता ({bd_val:.3f} g/cm³) {bd_interp_mr} आहे."
        ]

        return {
            "field": {
                "id": f"demo-field-gat-{display_gat}",
                "gat_no": display_gat,
                "area": gat_area,
                "area_unit": "hectare",
                "village": village_name,
                "taluka": taluka_name,
                "district": district_name,
                "state": "Maharashtra",
            },
            "farmer": {
                "id": 1,
                "name": farmer_name.strip() if (farmer_name and farmer_name.strip()) else "Ramesh Patil (रमेश पाटील)",
                "code": f"FARMER-{display_gat}",
            },
            "has_report": True,
            "is_demo": True,
            "report": {
                "id": int(display_gat) if display_gat.isdigit() else 12,
                "report_no": "SPL/2026/SL-0104",
                "receipt_no": "REC-7842/26",
                "sample_name": "Surface Soil Composite (0-15 cm)",
                "sample_date": "15-09-2026",
                "report_date": "20-09-2026",
                "crop_name": "Sugarcane (ऊस)",
                "organization_name": "ADT AI Training Foundation",
                "laboratory_name": "ADT AI Training Foundation — Agricultural Diagnostic & Digital Soil Testing Center, Baramati, Pune, Maharashtra",
                "center_name": "Agricultural Diagnostic & Digital Soil Testing Center",
                "center_location": "Pune, Maharashtra",
                "chemist_name": "A.B.C (Chief Chemist)",
                "is_demo": True,
                "status": "Demonstration Diagnostic Record",
                "observations": dynamic_observations,
                "observations_mr": dynamic_observations_mr,
            },
            "parameters": params,
            "key_recommendations": key_recs,
            "model_predictions": targets,
            "dsm_stats": {
                "gat_no": display_gat,
                "name": display_gat,
                "area_ha": gat_area,
                "area_acres": round(gat_area * 2.47105, 2),
                "area_sqm": round(gat_area * 10000, 1),
                "confidence": gat_stats.get("confidence", 91.2),
                "ph": gat_stats.get("ph") or {"mean": ph_val, "min": ph_val, "max": ph_val, "count": 1720},
                "soc": gat_stats.get("soc") or {"mean": soc_val, "min": round(soc_val * 0.9, 2), "max": round(soc_val * 1.1, 2), "count": 1720},
                "nitrogen": gat_stats.get("nitrogen") or {"mean": n_val or 179.5, "min": round(n_val * 0.9, 2), "max": round(n_val * 1.1, 2), "count": 1720},
                "bd": gat_stats.get("bd") or {"mean": bd_val, "min": 1.55, "max": 1.58, "count": 1720},
                "elevation": gat_stats.get("elevation") or {"mean": 568.5, "min": 560.0, "max": 575.5, "count": 1720},
                "ndvi": gat_stats.get("ndvi") or {"mean": 0.392, "min": 0.120, "max": 0.650, "count": 1720},
                "evi": gat_stats.get("evi") or {"mean": 0.241, "min": 0.080, "max": 0.420, "count": 1720},
                "uncertainty": gat_stats.get("uncertainty") or {"mean": 7.84, "min": 6.5, "max": 9.8, "count": 1720},
            },
            "observations": dynamic_observations,
            "observations_mr": dynamic_observations_mr,
        }

        # 3. For any unseeded field with no soil testing data
        return {
            "field": {
                "id": field.id,
                "gat_no": field.gat_no,
                "area": field.area,
                "area_unit": field.area_unit,
                "village": village.name if village else "",
                "taluka": taluka.name if taluka else "",
                "district": district.name if district else "",
                "state": "Maharashtra",
            },
            "farmer": {
                "id": farmer.id if farmer else None,
                "name": farmer.full_name if farmer else "Farmer",
                "code": farmer.farmer_code if farmer else "",
            },
            "has_report": False,
            "is_demo": False,
            "report": None,
            "parameters": [],
        }

    @staticmethod
    def get_summary_for_field(db: Session, field_identifier: str) -> Dict[str, Any]:
        full_report = SoilHealthService.get_report_for_field(db, field_identifier)
        if not full_report or not full_report.get("has_report"):
            return {
                "field_id": field_identifier,
                "has_report": False,
                "is_demo": False,
                "report_no": "Pending",
                "status": "Pending",
                "primary_parameters": {},
            }

        params_by_key = {p["key"]: p for p in full_report["parameters"]}
        
        primary_params = {}
        for key in ["ph", "ec", "organic_carbon", "available_nitrogen", "available_phosphorus", "available_potassium"]:
            item = params_by_key.get(key)
            if item:
                primary_params[key] = {
                    "name": item["name"],
                    "name_mr": item["name_mr"],
                    "value": item["value"],
                    "unit": item["unit"],
                    "interpretation": item["interpretation"],
                    "interpretation_mr": item["interpretation_mr"],
                    "source": item["source"],
                }

        return {
            "field_id": field_identifier,
            "has_report": True,
            "is_demo": full_report["is_demo"],
            "report_no": full_report["report"]["report_no"] if full_report["report"] else "Pending",
            "report_date": full_report["report"]["report_date"] if full_report["report"] else "Pending",
            "status": full_report["report"]["status"] if full_report["report"] else "Pending",
            "primary_parameters": primary_params,
            # Flat convenience fields for quick dashboard consumption
            "ph": params_by_key.get("ph", {}).get("value"),
            "ph_status": params_by_key.get("ph", {}).get("interpretation", "N/A"),
            "ec": params_by_key.get("ec", {}).get("value"),
            "organic_carbon": params_by_key.get("organic_carbon", {}).get("value"),
            "som": params_by_key.get("som", {}).get("value"),
            "nitrogen": params_by_key.get("available_nitrogen", {}).get("value"),
            "phosphorus": params_by_key.get("available_phosphorus", {}).get("value"),
            "potassium": params_by_key.get("available_potassium", {}).get("value"),
            "free_lime": params_by_key.get("free_lime", {}).get("value"),
            "zinc": params_by_key.get("zinc", {}).get("value"),
            "iron": params_by_key.get("iron", {}).get("value"),
            "bd": params_by_key.get("bd", {}).get("value"),
            "total_carbon": params_by_key.get("total_carbon", {}).get("value"),
        }

soil_health_service = SoilHealthService()
