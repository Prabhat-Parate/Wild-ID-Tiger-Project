from backend.taxonomy import parse_speciesnet_labels, match_scientific, SYNONYMS
from backend.species import load_registry, registry_with_support
from pathlib import Path

LABELS = parse_speciesnet_labels(Path("models/species-classifier/speciesnet.labels.txt"))

def test_chital_species_level_in_vocabulary():
    m = match_scientific("Axis axis", LABELS)
    assert m["level"] == "species"
    assert "chital" in (m["matched_label"] or "").lower()

def test_sarus_higher_rank_only():
    m = match_scientific("Antigone antigone", LABELS)
    assert m["level"] in {"genus", "family", "absent"}

def test_fish_eagle_absent():
    assert match_scientific("Icthyophaga ichthyaetus", LABELS)["level"] == "absent"

def test_mongoose_synonym():
    m = match_scientific("Urva edwardsii", LABELS)
    assert m["level"] == "species"
    assert "herpestes edwardsii" in SYNONYMS["urva edwardsii"]

def test_support_flags_from_vocabulary_not_hand_typed():
    body = registry_with_support(load_registry(), ["Tiger"], LABELS, False)
    by = {s["common_name"]: s for s in body["species"]}
    assert "species" in by["Chital"]["support_flag"].lower()
    assert "Not supported" in by["Grey-headed fish eagle"]["support_flag"] or by["Grey-headed fish eagle"]["classifier_match"]["level"] == "absent"
