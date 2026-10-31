from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


Severity = Literal["Low", "Medium", "High"]


class IssueCreate(BaseModel):
    title: str = Field(min_length=4, max_length=120)
    description: str = Field(min_length=12, max_length=2000)
    category: str = Field(min_length=2, max_length=64)
    severity: Severity
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class IssueRead(BaseModel):
    id: UUID
    title: str
    description: str
    category: str
    severity: str
    status: str
    latitude: float | None
    longitude: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TriageRequest(BaseModel):
    description: str = Field(min_length=8, max_length=2000)
    location_context: str | None = Field(default=None, max_length=180)


class TriageSuggestion(BaseModel):
    title: str
    cleaned_description: str
    category: str
    severity: Severity
    confidence: float
    needs_human_review: bool = True
    label: Literal["AI-suggested"] = "AI-suggested"


class AreaLookupRequest(BaseModel):
    description: str = Field(min_length=8, max_length=2000)
    category: str = Field(min_length=2, max_length=64)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class AreaSource(BaseModel):
    id: str
    title: str
    publisher: str
    url: str
    checked_at: str
    retrieved_live: bool = False


class AreaAuthority(BaseModel):
    name: str
    phone: str | None = None
    portal: str
    confidence: Literal["possible starting point"] = "possible starting point"
    caveat: str


class AreaLookupResult(BaseModel):
    area_name: str
    district: str | None = None
    ward: str | None = None
    city_match: bool
    authority: AreaAuthority | None = None
    area_note: str
    ai_summary: str | None = None
    ai_label: Literal["AI-suggested; verify against sources"] = "AI-suggested; verify against sources"
    sources: list[AreaSource]


class CampaignCreate(BaseModel):
    issue_id: str = Field(min_length=1, max_length=64)
    purpose: str = Field(min_length=4, max_length=120)
    target: int = Field(ge=1, le=100_000_000)
    deadline: date
    executor: str = Field(min_length=2, max_length=120)
    plan: str = Field(min_length=12, max_length=1000)


class CampaignPledgeCreate(BaseModel):
    display_name: str = Field(min_length=2, max_length=60)
    amount: int = Field(ge=1, le=10_000_000)

    @field_validator("display_name")
    @classmethod
    def clean_display_name(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 2:
            raise ValueError("Enter a display name with at least two characters")
        return cleaned


class CampaignPledgeRead(BaseModel):
    id: UUID
    display_name: str
    amount: int
    thank_you_note: str
    created_at: datetime
    kind: Literal["Pledge intent"] = "Pledge intent"

    model_config = {"from_attributes": True}


class CampaignRead(BaseModel):
    id: UUID
    issue_id: str
    purpose: str
    target: int
    deadline: date
    executor: str
    plan: str
    created_at: datetime
    contributions: list[CampaignPledgeRead]

    model_config = {"from_attributes": True}
