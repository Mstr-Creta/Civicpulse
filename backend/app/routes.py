from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from geoalchemy2 import WKTElement
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import get_session
from .models import Campaign, CampaignPledge, Issue
from .schemas import AreaLookupRequest, AreaLookupResult, CampaignCreate, CampaignPledgeCreate, CampaignPledgeRead, CampaignRead, IssueCreate, IssueRead, TriageRequest, TriageSuggestion
from .services.area_lookup import lookup_area_and_authority
from .services.triage import OllamaUnavailable, TriageOutputInvalid, suggest_triage as call_ollama_triage

router = APIRouter(prefix="/api/v1")


@router.post("/area-lookup", response_model=AreaLookupResult)
async def area_lookup(payload: AreaLookupRequest) -> AreaLookupResult:
    try:
        return await lookup_area_and_authority(payload)
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


def issue_response(issue: Issue) -> IssueRead:
    return IssueRead.model_validate(issue)


@router.get("/issues", response_model=list[IssueRead])
def list_issues(
    session: Session = Depends(get_session),
    category: str | None = None,
    status: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
) -> list[IssueRead]:
    query = select(Issue).order_by(Issue.created_at.desc()).limit(limit)
    if category:
        query = query.where(Issue.category == category)
    if status:
        query = query.where(Issue.status == status)
    return [issue_response(issue) for issue in session.scalars(query)]


@router.post("/issues", response_model=IssueRead, status_code=201)
def create_issue(payload: IssueCreate, session: Session = Depends(get_session)) -> IssueRead:
    point = None
    if payload.latitude is not None and payload.longitude is not None:
        point = WKTElement(f"POINT({payload.longitude} {payload.latitude})", srid=4326)
    issue = Issue(
        title=payload.title,
        description=payload.description,
        category=payload.category,
        severity=payload.severity,
        latitude=payload.latitude,
        longitude=payload.longitude,
        location=point,
    )
    session.add(issue)
    session.commit()
    session.refresh(issue)
    return issue_response(issue)


@router.get("/issues/{issue_id}", response_model=IssueRead)
def get_issue(issue_id: UUID, session: Session = Depends(get_session)) -> IssueRead:
    issue = session.get(Issue, issue_id)
    if issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")
    return issue_response(issue)


def campaign_response(campaign: Campaign, session: Session) -> CampaignRead:
    pledges = session.scalars(
        select(CampaignPledge).where(CampaignPledge.campaign_id == campaign.id).order_by(CampaignPledge.created_at.desc())
    )
    return CampaignRead(
        id=campaign.id,
        issue_id=campaign.issue_id,
        purpose=campaign.purpose,
        target=campaign.target,
        deadline=campaign.deadline,
        executor=campaign.executor,
        plan=campaign.plan,
        created_at=campaign.created_at,
        contributions=[CampaignPledgeRead.model_validate(pledge) for pledge in pledges],
    )


@router.get("/campaigns/{issue_id}", response_model=CampaignRead)
def get_campaign(issue_id: str, session: Session = Depends(get_session)) -> CampaignRead:
    campaign = session.scalar(select(Campaign).where(Campaign.issue_id == issue_id))
    if campaign is None:
        raise HTTPException(status_code=404, detail="No campaign for this issue")
    return campaign_response(campaign, session)


@router.post("/campaigns", response_model=CampaignRead, status_code=201)
def create_campaign(payload: CampaignCreate, session: Session = Depends(get_session)) -> CampaignRead:
    # sample-2 is the explicitly labeled verified demo issue; real issues must be verified in the database.
    verified = payload.issue_id == "sample-2"
    if not verified:
        try:
            issue = session.get(Issue, UUID(payload.issue_id))
        except ValueError:
            issue = None
        verified = issue is not None and issue.status == "Community verified"
    if not verified:
        raise HTTPException(status_code=403, detail="Campaigns require a community-verified issue")
    if session.scalar(select(Campaign.id).where(Campaign.issue_id == payload.issue_id)):
        raise HTTPException(status_code=409, detail="A campaign already exists for this issue")
    campaign = Campaign(**payload.model_dump())
    session.add(campaign)
    session.commit()
    session.refresh(campaign)
    return campaign_response(campaign, session)


@router.post("/campaigns/{issue_id}/contributions", response_model=CampaignPledgeRead, status_code=201)
def create_campaign_pledge(issue_id: str, payload: CampaignPledgeCreate, session: Session = Depends(get_session)) -> CampaignPledgeRead:
    campaign = session.scalar(select(Campaign).where(Campaign.issue_id == issue_id))
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    pledge = CampaignPledge(
        campaign_id=campaign.id,
        display_name=payload.display_name.strip(),
        amount=payload.amount,
        thank_you_note=f"Thank you, {payload.display_name.strip()}, for pledging ₹{payload.amount:,} toward {campaign.purpose}.",
    )
    session.add(pledge)
    session.commit()
    session.refresh(pledge)
    return CampaignPledgeRead.model_validate(pledge)


@router.post("/triage", response_model=TriageSuggestion)
async def suggest_triage(payload: TriageRequest) -> TriageSuggestion:
    try:
        return await call_ollama_triage(payload)
    except OllamaUnavailable as error:
        raise HTTPException(status_code=503, detail="Local Ollama is not available. Review the report without AI.") from error
    except TriageOutputInvalid as error:
        raise HTTPException(status_code=502, detail="Ollama returned an unusable suggestion. Review the report manually.") from error
