"""Lead DTOs."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.lead import LeadStatus


class LeadBase(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    telegram: str | None = None
    instagram: str | None = None
    city: str | None = None
    source: str | None = None
    campaign_id: str | None = None
    adset_id: str | None = None
    ad_id: str | None = None
    interest: str | None = None
    tags: str | None = ""
    consent: bool = False


class LeadCreate(LeadBase):
    external_id: str | None = None


class LeadUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    telegram: str | None = None
    instagram: str | None = None
    city: str | None = None
    interest: str | None = None
    tags: str | None = None
    status: LeadStatus | None = None
    manager_comment: str | None = None
    consent: bool | None = None


class LeadOut(LeadBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    score: int
    status: LeadStatus
    manager_comment: str | None = None
    landing_visits: int = 0
    clicked_price: bool = False
    added_to_cart: bool = False
    clicked_telegram: bool = False
    created_at: datetime
    updated_at: datetime
