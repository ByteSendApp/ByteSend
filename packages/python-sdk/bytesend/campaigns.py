"""Campaign resource client using TypedDict shapes (no Pydantic)."""
from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from .types import (
    APIError,
    Campaign,
    CampaignCreate,
    CampaignCreateResponse,
    CampaignSchedule,
    CampaignScheduleResponse,
    CampaignActionResponse,
)


class Campaigns:
    """Client for `/campaigns` endpoints."""

    def __init__(self, bytesend: "ByteSend") -> None:
        self.bytesend = bytesend

    def create(
        self, payload: CampaignCreate
    ) -> Tuple[Optional[CampaignCreateResponse], Optional[APIError]]:
        data, err = self.bytesend.post(
            "/campaigns",
            payload,
        )
        return (data, err)  # type: ignore[return-value]

    def get(
        self, campaign_id: str
    ) -> Tuple[Optional[Campaign], Optional[APIError]]:
        data, err = self.bytesend.get(
            f"/campaigns/{campaign_id}"
        )
        return (data, err)  # type: ignore[return-value]

    def schedule(
        self, campaign_id: str, payload: CampaignSchedule
    ) -> Tuple[Optional[CampaignScheduleResponse], Optional[APIError]]:
        data, err = self.bytesend.post(
            f"/campaigns/{campaign_id}/schedule",
            payload,
        )
        return (data, err)  # type: ignore[return-value]

    def pause(
        self, campaign_id: str
    ) -> Tuple[Optional[CampaignActionResponse], Optional[APIError]]:
        data, err = self.bytesend.post(
            f"/campaigns/{campaign_id}/pause",
            {},
        )
        return (data, err)  # type: ignore[return-value]

    def resume(
        self, campaign_id: str
    ) -> Tuple[Optional[CampaignActionResponse], Optional[APIError]]:
        data, err = self.bytesend.post(
            f"/campaigns/{campaign_id}/resume",
            {},
        )
        return (data, err)  # type: ignore[return-value]

    def delete(
        self, campaign_id: str
    ) -> Tuple[Optional[Campaign], Optional[APIError]]:
        data, err = self.bytesend.delete(f"/campaigns/{campaign_id}")
        return (data, err)  # type: ignore[return-value]


from .bytesend import ByteSend  # noqa: E402  pylint: disable=wrong-import-position