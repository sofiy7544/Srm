"""Unit tests for the lead scoring rules."""
from app.services.scoring import ScoreInput, is_hot, lead_score


def test_empty_lead_is_penalized():
    # No contact (-20) and no consent (-30).
    assert lead_score(ScoreInput()) == -50


def test_phone_and_telegram_and_consent():
    score = lead_score(
        ScoreInput(has_phone=True, has_telegram=True, has_contact=True, consent=True)
    )
    # +20 phone +20 telegram, no consent penalty.
    assert score == 40


def test_stanley_interest_bonus():
    base = ScoreInput(has_phone=True, has_contact=True, consent=True, interest="stanley")
    # +20 phone, +15 stanley.
    assert lead_score(base) == 35


def test_fitness_interest_bonus():
    s = lead_score(
        ScoreInput(has_phone=True, has_contact=True, consent=True, interest="water")
    )
    assert s == 35  # +20 phone +15 fitness-family


def test_full_hot_lead():
    score = lead_score(
        ScoreInput(
            has_phone=True,
            has_telegram=True,
            has_contact=True,
            consent=True,
            interest="stanley",
            from_lead_ads=True,
            landing_visits=2,
            clicked_price=True,
            added_to_cart=True,
        )
    )
    # 20+20+15(stanley)+10(lead_ads)+10(visits>1)+10(price)+20(cart) = 105
    assert score == 105
    assert is_hot(score)


def test_no_consent_penalty():
    with_consent = lead_score(ScoreInput(has_phone=True, has_contact=True, consent=True))
    without = lead_score(ScoreInput(has_phone=True, has_contact=True, consent=False))
    assert with_consent - without == 30


def test_is_hot_threshold():
    assert not is_hot(49)
    assert is_hot(50)
