"""The category list. Writes are validated against it; reads accept unknown keys."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Literal

Kind = Literal["income", "transfer", "personal", "expense"]


@dataclass(frozen=True)
class Category:
    key: str
    label: str
    schedule_c_line: str | None
    deductible_fraction: Decimal
    kind: Kind


def _c(key: str, label: str, line: str | None, frac: str, kind: Kind = "expense") -> Category:
    return Category(key, label, line, Decimal(frac), kind)


CATEGORIES: dict[str, Category] = {
    c.key: c
    for c in [
        _c("income", "Income", "1", "0", "income"),
        _c("transfer", "Transfer", None, "0", "transfer"),
        _c("personal", "Personal", None, "0", "personal"),
        _c("software", "Software & subscriptions", "18/27a", "1"),
        _c("meals", "Meals", "24b", "0.5"),
        _c("travel", "Travel", "24a", "1"),
        _c("office", "Office supplies", "18", "1"),
        _c("advertising", "Advertising", "8", "1"),
        _c("contractors", "Contractors", "11", "1"),
        _c("professional_services", "Legal & professional", "17", "1"),
        _c("insurance", "Insurance", "15", "1"),
        _c("utilities", "Phone & internet", "25", "1"),
        _c("rent", "Rent & workspace", "20b", "1"),
        _c("equipment", "Equipment", "13/22", "1"),
        _c("fees", "Bank & payment fees", "27a", "1"),
        _c("other", "Other business", "27a", "1"),
    ]
}

UNCATEGORIZED_LABEL = "Uncategorized"


def is_valid_category(key: str) -> bool:
    return key in CATEGORIES


def label_for(key: str | None) -> str:
    if key is None:
        return UNCATEGORIZED_LABEL
    cat = CATEGORIES.get(key)
    return cat.label if cat else key
