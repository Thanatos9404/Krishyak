"""WGS84 single exterior rings; no holes, multipart or antimeridian AOIs."""
import hashlib
import json
import math

from geographiclib.geodesic import Geodesic
from shapely.geometry import Polygon

MAX_VERTICES = 200


def normalize_geometry(geometry):
    coordinates = geometry.get("coordinates", [])
    if geometry.get("type") != "Polygon" or len(coordinates) != 1:
        raise ValueError("A WGS84 Polygon with one exterior ring is required")
    ring = coordinates[0]
    if not 3 <= len(ring) <= MAX_VERTICES + 1:
        raise ValueError("Use 3 to 200 vertices")
    for point in ring:
        if len(point) != 2 or any(isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x) for x in point):
            raise ValueError("Coordinates must be finite [longitude, latitude] pairs")
        if not -180 <= point[0] <= 180 or not -85 <= point[1] <= 85:
            raise ValueError("Longitude/latitude outside the supported WGS84 range")
    points = [[float(x) if x != 0 else 0.0 for x in p] for p in ring]
    if points[0] == points[-1]:
        points.pop()
    if not 3 <= len(points) <= MAX_VERTICES or len({tuple(p) for p in points}) != len(points):
        raise ValueError("At least three distinct vertices, without duplicates, are required")
    xs, ys = zip(*points)
    # Bound footprint too: a narrow, sprawling ring can have a tiny area and huge raster extent.
    if max(xs) - min(xs) > .25 or max(ys) - min(ys) > .25:
        raise ValueError("Field extent too large; use a field-scale polygon")
    polygon = Polygon(points)
    if not polygon.is_valid or polygon.area <= 0:
        raise ValueError("Polygon must be nondegenerate and must not intersect itself")
    # Canonical ring direction/start makes rotated/reversed equivalent requests share cache.
    if not polygon.exterior.is_ccw:
        points.reverse()
    start = min(range(len(points)), key=lambda i: tuple(points[i]))
    points = points[start:] + points[:start]
    return {"type": "Polygon", "coordinates": [points + [points[0]]]}


def area_details(geometry, max_area_ha=500):
    geometry = normalize_geometry(geometry)
    accumulator = Geodesic.WGS84.Polygon()
    for lon, lat in geometry["coordinates"][0][:-1]:
        accumulator.AddPoint(lat, lon)
    _, _, signed_area = accumulator.Compute()
    sqm = abs(signed_area)
    if sqm < 100 or sqm > max_area_ha * 10000:
        raise ValueError(f"Field must be between 100 square metres and {max_area_ha} hectares")
    return {"square_metres": round(sqm, 2), "hectares": round(sqm / 10000, 4),
            "acres": round(sqm / 4046.8564224, 4), "square_kilometres": round(sqm / 1e6, 6)}


def geometry_hash(geometry):
    value = json.dumps(normalize_geometry(geometry), separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(value.encode()).hexdigest()


def bbox(geometry):
    xs, ys = zip(*geometry["coordinates"][0])
    return [min(xs), min(ys), max(xs), max(ys)]
