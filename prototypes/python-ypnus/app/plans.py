"""Plan catalogue for the prototype.

Mirrors the public tiers in src/lib/pricing.ts of the Next.js app (Starter is retired and
deliberately absent). Checkout always goes to a Stripe Payment Link that requires a card;
the link URLs come from the environment so no price or link is hard-coded here.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

TRIAL_DAYS = 15


@dataclass(frozen=True)
class Plan:
    id: str
    name: str
    price: str
    cadence: str
    tagline: str
    features: tuple[str, ...]
    highlight: bool
    paid: bool

    @property
    def checkout_url(self) -> str | None:
        """Stripe Payment Link for this plan, or None when it is not configured."""
        if not self.paid:
            return None
        return os.environ.get(f"PAYMENT_LINK_{self.id.upper()}") or None


PLANS: tuple[Plan, ...] = (
    Plan(
        "free",
        "Free",
        "$0",
        "no card needed",
        "Try the AI intake assistant before you pay anything",
        (
            "AI borrower intake assistant",
            "Qualification and scoring",
            "Explore the borrower experience",
            "Live lead delivery starts on a paid plan",
        ),
        False,
        False,
    ),
    Plan(
        "growth",
        "Growth",
        "$99.99",
        "/mo",
        "More automation, same exclusive footprint",
        (
            "1 included exclusive zip code",
            "Higher automation run limits",
            "SMS and email nurture ladders",
            "Calendar booking and CRM mirroring",
            f"{TRIAL_DAYS}-day trial, card required",
        ),
        True,
        True,
    ),
    Plan(
        "pro",
        "Pro",
        "$199.99",
        "/mo",
        "For the serious loan officer",
        (
            "1 included exclusive zip code",
            "Portable loan officer website",
            "Priority lead delivery",
            "Advanced life-event signals",
            f"{TRIAL_DAYS}-day trial, card required",
        ),
        False,
        True,
    ),
    Plan(
        "elite",
        "Elite",
        "$299.99",
        "/mo",
        "Maximum automation and priority support",
        (
            "1 included exclusive zip code",
            "Priority access to additional zip codes",
            "Unlimited automation runs",
            "White-glove onboarding",
            f"{TRIAL_DAYS}-day trial, card required",
        ),
        False,
        True,
    ),
)


def starting_price() -> str:
    return next(p.price for p in PLANS if p.paid)
