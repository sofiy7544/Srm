"""Lead scoring.

Pure function so it is trivially unit-testable and side-effect free.
Rules mirror the product spec exactly.
"""
from dataclasses import dataclass

# Interests considered "high value" for the Stanley / fitness niche.
STANLEY_INTERESTS = {"stanley"}
FITNESS_INTERESTS = {"fitness", "water", "protein", "sport", "gym", "health"}


@dataclass
class ScoreInput:
    has_phone: bool = False
    has_telegram: bool = False
    interest: str | None = None
    from_lead_ads: bool = False
    landing_visits: int = 0
    clicked_price: bool = False
    added_to_cart: bool = False
    has_contact: bool = False
    consent: bool = False


def lead_score(data: ScoreInput) -> int:
    """Return an integer score per the agreed rule set."""
    score = 0

    if data.has_phone:
        score += 20
    if data.has_telegram:
        score += 20

    interest = (data.interest or "").strip().lower()
    if interest in STANLEY_INTERESTS:
        score += 15
    if interest in FITNESS_INTERESTS:
        score += 15

    if data.from_lead_ads:
        score += 10
    if data.landing_visits > 1:
        score += 10
    if data.clicked_price:
        score += 10
    if data.added_to_cart:
        score += 20

    if not data.has_contact:
        score -= 20
    if not data.consent:
        score -= 30

    return score


def score_for_lead(lead) -> int:
    """Build ScoreInput from a Lead ORM object and score it."""
    has_phone = bool(lead.phone)
    has_telegram = bool(lead.telegram)
    has_contact = bool(lead.phone or lead.email or lead.telegram)
    return lead_score(
        ScoreInput(
            has_phone=has_phone,
            has_telegram=has_telegram,
            interest=lead.interest,
            from_lead_ads=(lead.source == "lead_ads"),
            landing_visits=lead.landing_visits or 0,
            clicked_price=bool(lead.clicked_price),
            added_to_cart=bool(lead.added_to_cart),
            has_contact=has_contact,
            consent=bool(lead.consent),
        )
    )


def is_hot(score: int) -> bool:
    """A lead is 'hot' at >= 50 points."""
    return score >= 50
