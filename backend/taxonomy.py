"""Match Tadoba scientific names to a classifier label space. No guessing of species."""
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path

# Documented synonym / taxonomy changes. Not used to invent a species name.
SYNONYMS: dict[str, list[str]] = {
    "muntiacus muntjak": ["muntiacus vaginalis"],
    "muntiacus vaginalis": ["muntiacus muntjak"],
    "urva edwardsii": ["herpestes edwardsii"],
    "herpestes edwardsii": ["urva edwardsii"],
    "urva smithii": ["herpestes smithii"],
    "herpestes smithii": ["urva smithii"],
    "icthyophaga ichthyaetus": ["haliaeetus ichthyaetus"],
    "haliaeetus ichthyaetus": ["icthyophaga ichthyaetus"],
    "antigone antigone": ["grus antigone"],
}


@dataclass(frozen=True)
class TaxonLabel:
    uuid: str
    class_name: str
    order: str
    family: str
    genus: str
    species: str
    common: str

    @property
    def scientific(self) -> str:
        if self.genus and self.species:
            return f"{self.genus} {self.species}"
        return ""

    @property
    def rank(self) -> str:
        if self.genus and self.species:
            return "species"
        if self.genus:
            return "genus"
        if self.family:
            return "family"
        if self.order:
            return "order"
        if self.class_name:
            return "class"
        return "undetermined"


def parse_speciesnet_labels(path: Path) -> list[TaxonLabel]:
    rows: list[TaxonLabel] = []
    if not path.is_file():
        return rows
    for line in path.read_text(encoding="utf-8").splitlines():
        parts = line.split(";")
        if len(parts) < 7:
            continue
        rows.append(
            TaxonLabel(
                uuid=parts[0].strip(),
                class_name=parts[1].strip().lower(),
                order=parts[2].strip().lower(),
                family=parts[3].strip().lower(),
                genus=parts[4].strip().lower(),
                species=parts[5].strip().lower(),
                common=parts[6].strip(),
            )
        )
    return rows


def _norm(name: str) -> str:
    return " ".join((name or "").lower().split())


def match_scientific(scientific: str, labels: list[TaxonLabel]) -> dict:
    """Return coverage for one binomial against a label list."""
    sci = _norm(scientific)
    if not sci:
        return {"level": "absent", "rank": "undetermined", "matched_label": None, "scientific_name": None}
    aliases = [sci] + [_norm(a) for a in SYNONYMS.get(sci, [])]
    by_sci = { _norm(l.scientific): l for l in labels if l.scientific }
    for a in aliases:
        if a in by_sci:
            lab = by_sci[a]
            return {
                "level": "species",
                "rank": "species",
                "matched_label": lab.common or lab.scientific,
                "scientific_name": lab.scientific,
                "family": lab.family,
                "genus": lab.genus,
            }
    genus = sci.split()[0] if sci else ""
    genus_hits = [l for l in labels if l.genus == genus and l.genus]
    if genus_hits:
        species_level = [l for l in genus_hits if l.species]
        if species_level:
            return {
                "level": "genus",
                "rank": "genus",
                "matched_label": f"{genus.capitalize()} species",
                "scientific_name": genus.capitalize(),
                "family": genus_hits[0].family,
                "genus": genus,
            }
        return {
            "level": "genus",
            "rank": "genus",
            "matched_label": genus_hits[0].common or genus,
            "scientific_name": genus.capitalize(),
            "family": genus_hits[0].family,
            "genus": genus,
        }
    # family from any synonym genus in the label file
    families = {l.family for l in labels if l.genus == genus and l.family}
    if families:
        fam = next(iter(families))
        fam_row = next((l for l in labels if l.family == fam and not l.genus), None)
        return {
            "level": "family",
            "rank": "family",
            "matched_label": fam_row.common if fam_row else f"{fam} family",
            "scientific_name": fam,
            "family": fam,
            "genus": None,
        }
    return {"level": "absent", "rank": "undetermined", "matched_label": None, "scientific_name": None}


def support_flag(match: dict, classifier_inference: bool) -> str:
    level = match.get("level")
    if level == "species":
        if classifier_inference:
            return "Supported at species level"
        return "Supported at species level in classifier vocabulary (weights not loaded)"
    if level in {"genus", "family", "order", "class"}:
        rank = match.get("rank")
        if classifier_inference:
            return f"Higher rank only ({rank})"
        return f"Higher rank only ({rank}) in classifier vocabulary (weights not loaded)"
    return "Not supported"
