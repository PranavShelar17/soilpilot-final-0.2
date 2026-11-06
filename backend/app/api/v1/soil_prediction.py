"""API Endpoints for Digital Soil Mapping (DSM) Master Prediction System.
Serves scientifically validated predictions across all 15 soil targets
from the Super Learner Multi-Model Ensemble (IDW + Kriging + ML + RK).
"""

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field as PydanticField
from typing import Dict, Any, List, Optional
from app.services.soil_model_service import soil_model_service, TARGET_CONFIG, TARGETS

router = APIRouter(prefix="/soil-prediction", tags=["Soil Master Prediction Model"])


class PredictPointRequest(BaseModel):
    latitude: float = PydanticField(..., description="Latitude in decimal degrees (e.g. 18.156)")
    longitude: float = PydanticField(..., description="Longitude in decimal degrees (e.g. 74.530)")


@router.get("/targets", response_model=List[Dict[str, Any]])
def get_model_targets():
    """Lists all 15 soil fertility and physical properties predicted by the model."""
    result = []
    for target in TARGETS:
        cfg = TARGET_CONFIG[target]
        result.append({
            "target": target,
            "key": cfg["key"],
            "name": cfg["name"],
            "name_mr": cfg["name_mr"],
            "short_name": cfg["short_name"],
            "unit": cfg["unit"],
            "category": cfg["category"],
            "standard_key": cfg["standard_key"],
        })
    return result


@router.get("/point", response_model=Dict[str, Any])
def predict_soil_point_get(
    lat: float = Query(..., description="Latitude in decimal degrees"),
    lon: float = Query(..., description="Longitude in decimal degrees"),
):
    """Predicts all 15 soil properties at a specific GPS coordinate using the Master Model."""
    try:
        return soil_model_service.predict_point(lat, lon)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference error in SoilPredictionSystem: {str(e)}"
        )


@router.post("/predict", response_model=Dict[str, Any])
def predict_soil_point_post(req: PredictPointRequest):
    """Predicts all 15 soil properties at a specific GPS coordinate using the Master Model."""
    try:
        return soil_model_service.predict_point(req.latitude, req.longitude)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference error in SoilPredictionSystem: {str(e)}"
        )


@router.get("/gat/{gat_no}", response_model=Dict[str, Any])
def get_gat_soil_prediction(gat_no: str):
    """Returns the Master Model predictions across all 15 soil properties for a specific Gat parcel."""
    pred = soil_model_service.get_or_predict_gat(gat_no)
    if not pred:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Predictions not found for Gat '{gat_no}'."
        )
    return pred


@router.get("/all", response_model=List[Dict[str, Any]])
def get_all_gat_predictions():
    """Returns Master Model predictions across all 15 soil properties for all 220+ Gat parcels."""
    return soil_model_service.get_all_cadastral_records()

