import json
import statistics
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser

from ledger.models import MerchantSuggestion
from ledger.rules import normalize_merchant
from ledger.suggest import configured, suggest_category

EVAL_FILE = Path(__file__).resolve().parents[2] / "eval_suggestions.json"


class Command(BaseCommand):
    help = "Score category suggestions on a small labelled set (accuracy, p50/p95 latency)."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--no-cache", action="store_true", help="ignore cached suggestions")

    def handle(self, *args: Any, **opts: Any) -> None:
        if not configured():
            raise CommandError("Set LLM_BASE_URL and LLM_MODEL first.")
        cases = json.loads(EVAL_FILE.read_text())
        correct = 0
        got: str | None
        latencies: list[int] = []
        for case in cases:
            cached = None
            if not opts["no_cache"]:
                cached = MerchantSuggestion.objects.filter(
                    merchant_key=normalize_merchant(case["merchant"])
                ).first()
            if cached is not None:
                got, latency = cached.category, 0
            else:
                got, latency = suggest_category(
                    case["merchant"], case["description"], case["direction"]
                )
                latencies.append(latency)
            ok = got == case["expected"]
            correct += ok
            mark = "ok  " if ok else "MISS"
            self.stdout.write(
                f"{mark} {case['merchant']:<22} want={case['expected']:<21} got={got} ({latency}ms)"
            )
        total = len(cases)
        self.stdout.write(f"accuracy: {correct}/{total} = {correct / total:.0%}")
        if latencies:
            ordered = sorted(latencies)
            p95 = ordered[min(len(ordered) - 1, int(len(ordered) * 0.95))]
            self.stdout.write(f"latency p50={int(statistics.median(ordered))} ms p95={p95} ms")
