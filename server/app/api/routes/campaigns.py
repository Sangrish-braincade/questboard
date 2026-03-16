"""Campaign management API routes."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.campaign_manager import campaign_manager

router = APIRouter()


class CreateCampaignRequest(BaseModel):
    name: str
    description: str = ""


class CampaignSummary(BaseModel):
    name: str
    folder_name: str
    path: str
    description: str
    created_at: str
    system: str
    session_count: int
    player_count: int


@router.get("/", response_model=list[CampaignSummary])
async def list_campaigns():
    """List all campaigns in the DM's campaign root directory."""
    campaign_manager.ensure_root_exists()
    return campaign_manager.list_campaigns()


@router.post("/", response_model=CampaignSummary, status_code=201)
async def create_campaign(req: CreateCampaignRequest):
    """Create a new campaign with standard folder structure."""
    campaign_manager.ensure_root_exists()
    try:
        path = campaign_manager.create_campaign(req.name, req.description)
        folder_name = path.name
        campaign = campaign_manager.get_campaign(folder_name)
        if not campaign:
            raise HTTPException(500, "Campaign created but failed to read back")
        return campaign
    except FileExistsError:
        raise HTTPException(409, f"Campaign '{req.name}' already exists")


@router.get("/{folder_name}")
async def get_campaign(folder_name: str):
    """Get details for a specific campaign including file listings."""
    campaign = campaign_manager.get_campaign(folder_name)
    if not campaign:
        raise HTTPException(404, f"Campaign '{folder_name}' not found")
    return campaign


@router.delete("/{folder_name}")
async def delete_campaign(folder_name: str):
    """Delete a campaign. Files stay on disk for safety — DM deletes manually."""
    campaign = campaign_manager.get_campaign(folder_name)
    if not campaign:
        raise HTTPException(404, f"Campaign '{folder_name}' not found")
    return {
        "message": f"Campaign '{folder_name}' exists at {campaign['path']}. Delete the folder manually for safety."
    }
