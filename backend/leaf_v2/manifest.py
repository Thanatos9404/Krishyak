"""Build the leaf-model v2 manifest: every image, its label, source and split.

Sources are merged into one label space ("Crop___Condition"). Images are
grouped by exact pixels and by perceptual hash before splitting, so a copy of a
test photograph can never sit in training. The published PlantDoc test
partition stays an untouched field hold-out, exactly as in the v1 release, so
old and new models are compared on the same 229 photographs.

Every image is also written once, resized, to a local cache so training does
not read tens of thousands of files through a slow mount.

Run inside the training environment:
  python -m leaf_v2.manifest --datasets /mnt/c/.../datasets --cache /root/ml/cache --output /root/ml/run
"""

import argparse
import hashlib
import json
import os
import re
from collections import Counter, defaultdict
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from PIL import Image, ImageOps

EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
CACHE_SIDE = 448  # longest side kept in the cache; training crops from this

PLANTDOC = {
    "Apple Scab Leaf": "Apple___Apple_scab",
    "Apple leaf": "Apple___healthy",
    "Apple rust leaf": "Apple___Cedar_apple_rust",
    "Bell_pepper leaf spot": "Pepper,_bell___Bacterial_spot",
    "Bell_pepper leaf": "Pepper,_bell___healthy",
    "Blueberry leaf": "Blueberry___healthy",
    "Cherry leaf": "Cherry_(including_sour)___healthy",
    "Corn Gray leaf spot": "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
    "Corn leaf blight": "Corn_(maize)___Northern_Leaf_Blight",
    "Corn rust leaf": "Corn_(maize)___Common_rust_",
    "Peach leaf": "Peach___healthy",
    "Potato leaf early blight": "Potato___Early_blight",
    "Potato leaf late blight": "Potato___Late_blight",
    "Raspberry leaf": "Raspberry___healthy",
    "Soyabean leaf": "Soybean___healthy",
    "Squash Powdery mildew leaf": "Squash___Powdery_mildew",
    "Strawberry leaf": "Strawberry___healthy",
    "Tomato Early blight leaf": "Tomato___Early_blight",
    "Tomato Septoria leaf spot": "Tomato___Septoria_leaf_spot",
    "Tomato leaf bacterial spot": "Tomato___Bacterial_spot",
    "Tomato leaf late blight": "Tomato___Late_blight",
    "Tomato leaf mosaic virus": "Tomato___Tomato_mosaic_virus",
    "Tomato leaf yellow virus": "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
    "Tomato leaf": "Tomato___healthy",
    "Tomato mold leaf": "Tomato___Leaf_Mold",
    "Tomato two spotted spider mites leaf": "Tomato___Spider_mites Two-spotted_spider_mite",
    "grape leaf black rot": "Grape___Black_rot",
    "grape leaf": "Grape___healthy",
}
PADDY = {
    "bacterial_leaf_blight": "Rice___Bacterial_leaf_blight",
    "bacterial_leaf_streak": "Rice___Bacterial_leaf_streak",
    "bacterial_panicle_blight": "Rice___Bacterial_panicle_blight",
    "blast": "Rice___Blast",
    "brown_spot": "Rice___Brown_spot",
    "dead_heart": "Rice___Dead_heart",
    "downy_mildew": "Rice___Downy_mildew",
    "hispa": "Rice___Hispa",
    "normal": "Rice___healthy",
    "tungro": "Rice___Tungro",
}
SUGARCANE = {
    "Healthy": "Sugarcane___healthy",
    "Mosaic": "Sugarcane___Mosaic",
    "RedRot": "Sugarcane___Red_rot",
    "Rust": "Sugarcane___Rust",
    "Yellow": "Sugarcane___Yellow_leaf",
}
WHEAT_LEAF = {"Healthy": "Wheat___healthy", "septoria": "Wheat___Septoria", "stripe_rust": "Wheat___Yellow_rust"}
COTTON = {
    "Bacterial Blight": "Cotton___Bacterial_blight",
    "Curl Virus": "Cotton___Leaf_curl_virus",
    "Healthy Leaf": "Cotton___healthy",
    "Herbicide Growth Damage": "Cotton___Herbicide_damage",
    "Leaf Hopper Jassids": "Cotton___Jassid_damage",
    "Leaf Redding": "Cotton___Leaf_reddening",
    "Leaf Variegation": "Cotton___Leaf_variegation",
}
# The older repository collection: sources and licences were never established.
LEGACY = {
    "Becterial Blight in Rice": "Rice___Bacterial_leaf_blight",
    "Brownspot": "Rice___Brown_spot",
    "Rice Blast": "Rice___Blast",
    "Tungro": "Rice___Tungro",
    "bacterial_blight in Cotton": "Cotton___Bacterial_blight",
    "Bacterial Blight in cotton": "Cotton___Bacterial_blight",
    "Leaf Curl": "Cotton___Leaf_curl_virus",
    "Healthy cotton": "Cotton___healthy",
    "Healthy Wheat": "Wheat___healthy",
    "Wheat black rust": "Wheat___Black_rust",
    "Wheat Brown leaf Rust": "Wheat___Brown_rust",
    "Wheat Brown leaf rust": "Wheat___Brown_rust",
    "Wheat leaf blight": "Wheat___Leaf_blight",
    "Wheat powdery mildew": "Wheat___Powdery_mildew",
    "Wheat___Yellow_Rust": "Wheat___Yellow_rust",
}
WHEAT_PLANT = {
    "black rust": "Wheat___Black_rust",
    "brown rust": "Wheat___Brown_rust",
    "yellow rust": "Wheat___Yellow_rust",
    "healthy": "Wheat___healthy",
    "leaf blight": "Wheat___Leaf_blight",
    "mildew": "Wheat___Powdery_mildew",
    "septoria": "Wheat___Septoria",
    "tan spot": "Wheat___Tan_spot",
    "smut": "Wheat___Loose_smut",
    "fusarium head blight": "Wheat___Fusarium_head_blight",
    "aphid": "Wheat___Aphid",
    "blast": "Wheat___Blast",
    "mite": "Wheat___Mite",
    "stem fly": "Wheat___Stem_fly",
    "common root rot": "Wheat___Common_root_rot",
}
TOMATO_VILLAGE = {
    "Early_blight": "Tomato___Early_blight",
    "Late_blight": "Tomato___Late_blight",
    "Healthy": "Tomato___healthy",
    "Leaf Miner": "Tomato___Leaf_miner",
    "Magnesium Deficiency": "Tomato___Nutrient_deficiency",
    "Nitrogen Deficiency": "Tomato___Nutrient_deficiency",
    "Pottassium Deficiency": "Tomato___Nutrient_deficiency",
    "Spotted Wilt Virus": "Tomato___Spotted_wilt_virus",
}
# PlantWild (in-the-wild web photographs): classes of crops this model already covers.
PLANTWILD = {
    "apple black rot": "Apple___Black_rot",
    "apple leaf": "Apple___healthy",
    "apple rust": "Apple___Cedar_apple_rust",
    "apple scab": "Apple___Apple_scab",
    "apple mosaic virus": "Apple___Mosaic_virus",
    "bell pepper leaf spot": "Pepper,_bell___Bacterial_spot",
    "bell pepper leaf": "Pepper,_bell___healthy",
    "cherry leaf": "Cherry_(including_sour)___healthy",
    "cherry powdery mildew": "Cherry_(including_sour)___Powdery_mildew",
    "cherry leaf spot": "Cherry_(including_sour)___Leaf_spot",
    "citrus greening disease": "Orange___Haunglongbing_(Citrus_greening)",
    "citrus canker": "Orange___Citrus_canker",
    "corn gray leaf spot": "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
    "corn northern leaf blight": "Corn_(maize)___Northern_Leaf_Blight",
    "corn rust": "Corn_(maize)___Common_rust_",
    "corn leaf": "Corn_(maize)___healthy",
    "corn smut": "Corn_(maize)___Smut",
    "grape black rot": "Grape___Black_rot",
    "grape leaf": "Grape___healthy",
    "grape leaf spot": "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
    "grape downy mildew": "Grape___Downy_mildew",
    "peach leaf": "Peach___healthy",
    "peach leaf curl": "Peach___Leaf_curl",
    "potato early blight": "Potato___Early_blight",
    "potato late blight": "Potato___Late_blight",
    "potato leaf": "Potato___healthy",
    "squash powdery mildew": "Squash___Powdery_mildew",
    "squash leaf": "Squash___healthy",
    "strawberry leaf": "Strawberry___healthy",
    "strawberry leaf scorch": "Strawberry___Leaf_scorch",
    "tomato bacterial leaf spot": "Tomato___Bacterial_spot",
    "tomato early blight": "Tomato___Early_blight",
    "tomato late blight": "Tomato___Late_blight",
    "tomato leaf mold": "Tomato___Leaf_Mold",
    "tomato leaf": "Tomato___healthy",
    "tomato mosaic virus": "Tomato___Tomato_mosaic_virus",
    "tomato septoria leaf spot": "Tomato___Septoria_leaf_spot",
    "tomato yellow leaf curl virus": "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
}


def canonical(text):
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def images(folder):
    return sorted(p for p in folder.rglob("*") if p.suffix.lower() in EXTENSIONS)


def candidates(root):
    """Yield (path, label, source, domain, forced_split) for every usable image."""
    pv = root / "authentic/PlantVillage/raw/color"
    for path in images(pv):
        yield path, path.parent.name, "PlantVillage", "lab", None
    doc = root / "authentic/PlantDoc-export"
    for split in ("train", "test"):
        for path in images(doc / split):
            yield path, PLANTDOC[path.parent.name], "PlantDoc", "field", "external_test" if split == "test" else None
    paddy = root / "field/paddy-doctor/paddy-disease-classification/train_images"
    for path in images(paddy):
        yield path, PADDY[path.parent.name], "PaddyDoctor", "field", None
    for path in images(root / "field/sugarcane-leaf-disease-dataset"):
        if path.parent.name in SUGARCANE:
            yield path, SUGARCANE[path.parent.name], "SugarcaneLeaf", "field", None
    for path in images(root / "field/wheat-leaf-dataset/wheat_leaf"):
        yield path, WHEAT_LEAF[path.parent.name], "WheatLeaf", "field", None
    cotton = root / "field/sar-cld-2024-dataset-for-cotton-leaf"
    for path in images(cotton):
        # The published "Augmented Dataset" is derived from the originals; only originals are used.
        if "Original Dataset" in path.parts and path.parent.name in COTTON:
            yield path, COTTON[path.parent.name], "SAR-CLD-2024", "field", None
    for path in images(root / "field/tomato-village"):
        if "Variant-a(Multiclass Classification)" in path.parts and path.parent.name in TOMATO_VILLAGE:
            yield path, TOMATO_VILLAGE[path.parent.name], "TomatoVillage", "field", None
    for path in images(root / "field/wheat-plant-diseases"):
        # The publisher's train/valid/test folders are pooled and re-split with duplicate grouping.
        name = " ".join(word for word in canonical(path.parent.name).split() if word not in ("test", "valid"))
        label = WHEAT_PLANT.get(name)
        if label:
            yield path, label, "WheatPlantDiseases", "field", None
    wild = {canonical(name): label for name, label in PLANTWILD.items()}
    for path in images(root / "field/plantwild-dataset-ready-for-preprocessing"):
        label = wild.get(canonical(path.parent.name))
        if label:
            yield path, label, "PlantWild", "field", None
    for split in ("Train", "Validation"):
        for path in images(root / "pdisease" / split):
            label = LEGACY.get(path.parent.name)
            if label:
                yield path, label, "legacy_unverified", "mixed", None


def fingerprint(job):
    """Hash one image and write its resized copy to the cache. Returns None when unreadable."""
    path, cache = job
    try:
        raw = Path(path).read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        with Image.open(path) as image:
            image = ImageOps.exif_transpose(image)
            if image.mode in ("RGBA", "LA") or "transparency" in image.info:
                image = Image.alpha_composite(Image.new("RGBA", image.size, "white"), image.convert("RGBA"))
            rgb = image.convert("RGB")
            small = rgb.resize((64, 64))
            pixel_hash = hashlib.sha256(small.tobytes()).hexdigest()
            gray = list(rgb.convert("L").resize((9, 8)).getdata())
            visual = "".join("1" if gray[y * 9 + x] > gray[y * 9 + x + 1] else "0" for y in range(8) for x in range(8))
            target = Path(cache) / digest[:2] / f"{digest}.jpg"
            if not target.exists():
                target.parent.mkdir(parents=True, exist_ok=True)
                rgb.thumbnail((CACHE_SIDE, CACHE_SIDE), Image.LANCZOS)
                rgb.save(target, "JPEG", quality=92)
        return digest, pixel_hash, visual, min(image.size)
    except Exception as error:  # noqa: BLE001 - unreadable files are reported, not fatal
        return type(error).__name__


def stable_split(group):
    value = int(hashlib.sha256(("krishyak-leaf-v2:" + group).encode()).hexdigest()[:8], 16) % 100
    return "train" if value < 72 else "validation" if value < 84 else "test"


def build(datasets, cache, output, workers):
    rows = list(candidates(datasets))
    print(f"{len(rows):,} candidate images", flush=True)
    with ProcessPoolExecutor(workers) as pool:
        prints = list(pool.map(fingerprint, [(str(row[0]), str(cache)) for row in rows], chunksize=64))
    parents = {}

    def find(x):
        parents.setdefault(x, x)
        while parents[x] != x:
            parents[x] = parents[parents[x]]
            x = parents[x]
        return x

    def union(a, b):
        a, b = find(a), find(b)
        if a != b:
            parents[max(a, b)] = min(a, b)

    records, rejected, seen = [], [], {}
    for (path, label, source, domain, forced), result in zip(rows, prints, strict=True):
        relative = path.relative_to(datasets).as_posix()
        if isinstance(result, str):
            rejected.append({"path": relative, "reason": result})
            continue
        digest, pixel_hash, visual, short_side = result
        if short_side < 64:
            rejected.append({"path": relative, "reason": "smaller than 64 px"})
            continue
        group = "g:" + pixel_hash
        for key in ("p:" + pixel_hash, "v:" + visual):
            if key in seen:
                union(group, seen[key])
            seen[key] = find(group)
        records.append(
            {
                "path": relative,
                "cache": f"{digest[:2]}/{digest}.jpg",
                "label": label,
                "source": source,
                "domain": domain,
                "group": group,
                "pixel_hash": pixel_hash,
                "forced": forced,
            }
        )
    groups = defaultdict(list)
    for row in records:
        row["group"] = find(row["group"])
        groups[row["group"]].append(row)
    labels_of = defaultdict(set)
    for row in records:
        labels_of[row["pixel_hash"]].add(row["label"])
    kept, duplicates, conflicts = [], 0, 0
    for group, members in groups.items():
        clean = [r for r in members if len(labels_of[r["pixel_hash"]]) == 1]
        conflicts += len(members) - len(clean)
        if not clean:
            continue
        split = "external_test" if any(r["forced"] == "external_test" for r in clean) else stable_split(group)
        unique = set()
        for row in clean:
            if row["pixel_hash"] in unique:
                duplicates += 1
                continue
            unique.add(row["pixel_hash"])
            row["split"] = split
            row.pop("forced")
            row.pop("pixel_hash")
            kept.append(row)
    counts = Counter(r["label"] for r in kept if r["split"] == "train")
    # A class needs enough training images to be learnable and enough held out to be measured.
    labels = sorted(label for label, n in counts.items() if n >= 60)
    dropped = sorted(set(r["label"] for r in kept) - set(labels))
    kept = [r for r in kept if r["label"] in labels]
    audit = {
        "images": len(kept),
        "classes": len(labels),
        "duplicates_removed": duplicates,
        "conflicting_labels_quarantined": conflicts,
        "unreadable_or_tiny": len(rejected),
        "classes_dropped_for_too_few_images": dropped,
        "by_source_and_split": dict(sorted(Counter(f"{r['source']}/{r['split']}" for r in kept).items())),
        "by_label_and_split": {
            label: dict(Counter(r["split"] for r in kept if r["label"] == label)) for label in labels
        },
        "split_policy": "72/12/16 deterministic split of duplicate groups (exact pixels at 64 px and 64-bit difference hash); "
        "the published PlantDoc test partition is reserved as the external field test",
        "limits": [
            "Hash grouping removes copies, not different photographs of the same plant or field.",
            "legacy_unverified images have no established source or licence and are reported separately.",
            "Field sources come from India, Bangladesh, Ethiopia and web collections; none is a planned sample of Indian farms.",
        ],
    }
    output.mkdir(parents=True, exist_ok=True)
    (output / "manifest.json").write_text(json.dumps(kept), encoding="utf-8")
    (output / "class_indices.json").write_text(json.dumps(dict(enumerate(labels)), indent=2), encoding="utf-8")
    (output / "data_audit.json").write_text(json.dumps(audit, indent=2), encoding="utf-8")
    (output / "rejected.json").write_text(json.dumps(rejected[:5000], indent=1), encoding="utf-8")
    print(json.dumps({k: v for k, v in audit.items() if k != "by_label_and_split"}, indent=2), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--datasets", type=Path, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--workers", type=int, default=max(2, (os.cpu_count() or 4) - 2))
    args = parser.parse_args()
    build(args.datasets, args.cache, args.output, args.workers)
