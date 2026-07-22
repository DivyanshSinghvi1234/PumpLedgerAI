from __future__ import annotations

import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.core.dependencies import get_db, get_current_user
from app.models.nps_rating import NPSRating
from app.models.voucher import Voucher
from app.models.user import User

router = APIRouter(prefix="/nps", tags=["Net Promoter Score (NPS)"])


class NPSRateInput(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Star rating between 1 and 5")
    feedback: str | None = Field(None, max_length=1000)


class NPSGenerateInput(BaseModel):
    customer_phone: str | None = None
    voucher_uuid: str | None = None


class NPSGenerateResponse(BaseModel):
    token: str
    public_url: str


class FeedbackItem(BaseModel):
    date: str
    phone: str | None
    rating: int
    feedback: str | None
    voucher_number: str | None


class NPSAnalyticsResponse(BaseModel):
    nps_score: float
    average_rating: float
    total_ratings: int
    rating_distribution: dict[int, int]
    feedbacks: list[FeedbackItem]


# 1. PUBLIC route: submit rating via token
@router.post("/rate/{token}", status_code=status.HTTP_200_OK)
def rate_nps(token: str, data: NPSRateInput, db: Session = Depends(get_db)):
    nps_entry = db.scalar(
        select(NPSRating).where(NPSRating.token == token)
    )
    if not nps_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NPS entry token not found or invalid",
        )

    nps_entry.rating = data.rating
    nps_entry.feedback = data.feedback
    nps_entry.is_active = True  # mark as responded
    db.commit()

    return {"message": "Thank you for your feedback!"}


# 2. PROTECTED helper: generate a token/entry
@router.post("/generate", response_model=NPSGenerateResponse, dependencies=[Depends(get_current_user)])
def generate_nps_token(data: NPSGenerateInput, db: Session = Depends(get_db)):
    # Find voucher if voucher_uuid was passed
    voucher_id = None
    if data.voucher_uuid:
        v = db.scalar(select(Voucher).where(Voucher.uuid == data.voucher_uuid))
        if v:
            voucher_id = v.id

    token = f"nps-{secrets.token_urlsafe(16)}"
    
    from app.database.scoping import active_pump_id
    pump_id = active_pump_id.get()
    
    if not pump_id:
        if data.voucher_uuid and v:
            pump_id = v.pump_id
        else:
            # Fetch the first pump if no active scoping header is present to fallback
            pump = db.scalar(select(__import__("app").models.pump.Pump).limit(1))
            if pump:
                pump_id = pump.id
            else:
                pump_id = 1

    nps_entry = NPSRating(
        token=token,
        customer_phone=data.customer_phone,
        voucher_id=voucher_id,
        rating=-1,  # initial placeholder rating
        pump_id=pump_id,
    )
    db.add(nps_entry)
    db.commit()

    # The public URL layout we will build is: /public/rate/:token
    public_url = f"/public/rate/{token}"

    return NPSGenerateResponse(token=token, public_url=public_url)


# 3. AUTHENTICATED analytics dashboard route
@router.get("/analytics", response_model=NPSAnalyticsResponse, dependencies=[Depends(get_current_user)])
def get_nps_analytics(db: Session = Depends(get_db)):
    # Retrieve all submitted NPS ratings (rating is valid, i.e., between 1 and 5)
    entries = db.scalars(
        select(NPSRating)
        .where(NPSRating.rating >= 1, NPSRating.rating <= 5)
        .order_by(NPSRating.created_at.desc(), NPSRating.id.desc())
    ).all()

    total = len(entries)
    
    rating_distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    feedbacks = []
    
    if total == 0:
        return NPSAnalyticsResponse(
            nps_score=0.0,
            average_rating=0.0,
            total_ratings=0,
            rating_distribution=rating_distribution,
            feedbacks=[],
        )

    promoters = 0
    detractors = 0
    total_stars = 0

    for e in entries:
        rating_distribution[e.rating] += 1
        total_stars += e.rating

        if e.rating in (4, 5):
            promoters += 1
        elif e.rating in (1, 2):
            detractors += 1

        voucher_num = e.voucher.invoice_number if e.voucher else None
        
        feedbacks.append(
            FeedbackItem(
                date=e.created_at.date().isoformat(),
                phone=e.customer_phone,
                rating=e.rating,
                feedback=e.feedback,
                voucher_number=voucher_num,
            )
        )

    # Net Promoter Score formula
    nps_score = ((promoters - detractors) / total) * 100
    average_rating = total_stars / total

    return NPSAnalyticsResponse(
        nps_score=round(nps_score, 1),
        average_rating=round(average_rating, 2),
        total_ratings=total,
        rating_distribution=rating_distribution,
        feedbacks=feedbacks,
    )
