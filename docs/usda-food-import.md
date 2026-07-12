# USDA FoodData Central Import Foundation

## Purpose

The USDA importer is an offline, review-first tool for adding generic food data to OptiMe's local Food Catalog. It is never called by mobile clients, the Nest API, or daily-plan generation.

Daily plans continue to use only active catalog foods. New USDA records are deliberately imported with `isActive=false`, no diet suitability, and no restriction tags. This prevents unreviewed source data from bypassing allergy, exclusion, or diet safety rules.

## Input

Download an official FoodData Central JSON export and provide its local path to the script. The default scope accepts `Foundation` records only. The parser expects an FDC ID, description, and nutrients for energy in kcal, protein, carbohydrate, and fat per 100 g. Fiber is optional.

The importer supports either a root array or an object containing `foods`, `FoundationFoods`, or `foundationFoods`.

## Safe workflow

1. Run a dry-run first. It performs no database writes.
2. Inspect the prepared count and sample descriptions.
3. Apply a small batch to the local database.
4. Review each imported food: category, nutrition values, English name, translations, diet suitability, and restriction tags.
5. Activate only reviewed items through a future catalog-curation workflow. Until then, they cannot enter AI candidate lists or deterministic fallback templates.

```powershell
# Dry run: no database changes.
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api food-catalog:usda:import -- --input "C:\data\FoundationFoods.json" --limit 25

# Write a reviewed import batch as inactive catalog records.
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api food-catalog:usda:import -- --input "C:\data\FoundationFoods.json" --limit 25 --apply
```

To include a different official FDC data type intentionally, pass it explicitly:

```powershell
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api food-catalog:usda:import -- --input "C:\data\SRLegacyFoods.json" --data-types "SR Legacy" --limit 25
```

## Guarantees

- imports are idempotent by `source=USDA_FDC` plus `sourceFoodId`;
- records missing required nutrients, an ID, or a description are skipped;
- implausible numeric nutrition values are skipped;
- an already active USDA record is treated as locally reviewed and is never overwritten by a later import;
- the importer does not download data or use API keys;
- no unreviewed USDA record can affect daily plan generation.

## Source and future work

USDA states that FoodData Central data are public domain under CC0 and provides both data downloads and an API. The API requires a data.gov key and is rate-limited, so OptiMe's initial workflow imports a deliberately reviewed local snapshot rather than fetching from the API during normal product operation.

Future work may add a protected admin-only source update job, source release tracking, localization review, and a catalog-curation activation workflow. It must retain the inactive-by-default boundary.
