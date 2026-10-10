"""Add canonical crop identity without rewriting historical provider names."""

import sqlalchemy as sa
from alembic import op

revision = "v2_0005"
down_revision = "v2_0004"
branch_labels = depends_on = None

# Frozen aliases keep historical migrations independent of future catalogs.
ALIASES = {
    "Wheat": "wheat",
    "Rice": "rice",
    "Mustard": "mustard",
    "Gram": "chickpea",
    "Chickpea": "chickpea",
    "Cotton": "cotton",
    "Maize": "maize",
    "Sugarcane": "sugarcane",
    "Soybean": "soybean",
    "Groundnut": "groundnut",
    "Tomato": "tomato",
    "Potato": "potato",
    "Onion": "onion",
    "Chilli": "chilli",
    "Bajra": "bajra",
    "Jowar": "jowar",
    "Ragi": "ragi",
    "Apple": "apple",
    "Banana": "banana",
    "Barley": "barley",
    "Black Pepper": "black_pepper",
    "Blueberry": "blueberry",
    "Brinjal": "brinjal",
    "Cabbage": "cabbage",
    "Capsicum": "capsicum",
    "Cardamom": "cardamom",
    "Carrot": "carrot",
    "Cauliflower": "cauliflower",
    "Cherry": "cherry",
    "Coconut": "coconut",
    "Coriander": "coriander",
    "Cucumber": "cucumber",
    "Cumin": "cumin",
    "Fenugreek": "fenugreek",
    "Garlic": "garlic",
    "Ginger": "ginger",
    "Grapes": "grapes",
    "Green Peas": "green_peas",
    "Guava": "guava",
    "Jute": "jute",
    "Lemon": "lemon",
    "Lentil": "lentil",
    "Litchi": "litchi",
    "Mango": "mango",
    "Moong": "moong",
    "Okra": "okra",
    "Orange": "orange",
    "Papaya": "papaya",
    "Peach": "peach",
    "Tur": "pigeon_pea",
    "Arhar": "pigeon_pea",
    "Pomegranate": "pomegranate",
    "Pumpkin": "pumpkin",
    "Radish": "radish",
    "Raspberry": "raspberry",
    "Sesame": "sesame",
    "Spinach": "spinach",
    "Squash": "squash",
    "Strawberry": "strawberry",
    "Sunflower": "sunflower",
    "Tobacco": "tobacco",
    "Turmeric": "turmeric",
    "Urad": "urad",
    "Watermelon": "watermelon",
}


def upgrade():
    op.add_column("v2_crop_cycles", sa.Column("crop_id", sa.String(50), nullable=True))
    statement = sa.text("UPDATE v2_crop_cycles SET crop_id = :identity WHERE crop = :name")
    for name, identity in ALIASES.items():
        op.get_bind().execute(statement, {"name": name, "identity": identity})


def downgrade():
    op.drop_column("v2_crop_cycles", "crop_id")
