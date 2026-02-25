import requests
import csv

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    airtable_personal_access_token: str
    class Config:
        env_file = ".env"


settings = Settings()

# ============================================================
# CONFIGURATION - Fill in your details here
# These all come from your Airtable URL:
# https://airtable.com/appXXXX/tblXXXX/viwXXXX
# ============================================================
PERSONAL_ACCESS_TOKEN = settings.airtable_person_access_token
BASE_ID   = "appCCdbkIssYUCK54"   # starts with "app"
TABLE_ID  = "tblCMH3UbYdUybXce"   # starts with "tbl"
VIEW_ID   = "viwlwfBp7U5kqEIQ8"   # starts with "viw"
OUTPUT_FILE = "stats.csv"

# List any field names you want to exclude from the export.
# Copy names exactly as they appear in Airtable (case-sensitive).
# Leave empty to export all fields: EXCLUDE_FIELDS = []
EXCLUDE_FIELDS = [
    'F Date',
    'Notes',
    'Deficit',
    'Target (kcal)',
    'Waist (Inches)',
    'Training Notes',
    'Calories from Macros (kcal)',
    'Mismatch (kcal)',
]
# ============================================================

HEADERS = {
    "Authorization": f"Bearer {PERSONAL_ACCESS_TOKEN}",
    "Content-Type": "application/json"
}

def get_all_fields():
    """Fetch all field names for the table."""
    url = f"https://api.airtable.com/v0/meta/bases/{BASE_ID}/tables"
    response = requests.get(url, headers=HEADERS)
    response.raise_for_status()

    tables = response.json().get("tables", [])
    for table in tables:
        if table["id"] == TABLE_ID:
            return [f["name"] for f in table["fields"]]

    raise ValueError(f"Table ID '{TABLE_ID}' not found in base '{BASE_ID}'.")


def get_all_records(fields):
    """Fetch all records from Airtable, paginating as needed."""
    url = f"https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}"
    records = []
    params = {
        "fields[]": fields,
        "view": VIEW_ID,
        "pageSize": 100
    }

    while True:
        response = requests.get(url, headers=HEADERS, params=params)
        response.raise_for_status()
        data = response.json()

        records.extend(data.get("records", []))
        print(f"  Fetched {len(records)} records so far...")

        offset = data.get("offset")
        if not offset:
            break
        params["offset"] = offset

    return records


def export_to_csv(fields, records):
    """Write records to a CSV file."""
    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for record in records:
            row = {field: record["fields"].get(field, "") for field in fields}
            writer.writerow(row)
    print(f"\nExport complete! Saved {len(records)} records to '{OUTPUT_FILE}'")


def main():
    print("Fetching fields...")
    all_fields = get_all_fields()

    fields = [f for f in all_fields if f not in EXCLUDE_FIELDS]
    excluded = [f for f in all_fields if f in EXCLUDE_FIELDS]

    print(f"Exporting {len(fields)} fields, skipping {len(excluded)}: {excluded or 'none'}\n")

    print("Fetching records...")
    records = get_all_records(fields)

    export_to_csv(fields, records)


if __name__ == "__main__":
    main()
