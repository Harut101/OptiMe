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

Use `--offset` to inspect or import the next small source batch without reprocessing the first group. It is a source-file offset, not a database offset.

```powershell
# Review the second source batch without writing it.
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api food-catalog:usda:import -- --input "C:\data\FoundationFoods.json" --offset 25 --limit 25
```

To include a different official FDC data type intentionally, pass it explicitly:

```powershell
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api food-catalog:usda:import -- --input "C:\data\SRLegacyFoods.json" --data-types "SR Legacy" --limit 25
```

## Curation and activation

An import alone never activates a food. Create a review manifest after checking the imported USDA item. It must provide a category, at least one allowed diet type, restriction tags, and translations for every product locale.

```json
{
  "version": 1,
  "foods": [
    {
      "sourceFoodId": "123456",
      "category": "VEGETABLE",
      "dietTypes": ["OMNIVORE", "VEGETARIAN", "VEGAN", "PESCATARIAN", "MEDITERRANEAN"],
      "restrictionTags": [],
      "translations": {
        "en-US": { "name": "Reviewed foundation vegetable", "aliases": [] },
        "ru-RU": { "name": "Проверенный овощ", "aliases": [] },
        "fr-FR": { "name": "Légume vérifié", "aliases": [] },
        "zh-CN": { "name": "已审核蔬菜", "aliases": [] }
      }
    }
  ]
}
```

Run curation as dry-run first, then use `--apply` deliberately:

```powershell
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api food-catalog:usda:curate -- --input "C:\data\usda-curation.json"
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api food-catalog:usda:curate -- --input "C:\data\usda-curation.json" --apply
```

The curation script refuses unknown FDC IDs. It also does not let a raw import overwrite an already active, reviewed item.

The repository includes reviewed fresh-produce, mushroom/almond-milk, and berry/snack manifests under `apps/api/prisma/seeds/foods/usda-curation/`. They activate only explicitly reviewed foods; all other imported source records remain inactive until separately reviewed.

### Review imported records

List imported USDA records before creating a manifest. This command is read-only and helps reviewers check the source name, provisional category, active state, and nutrition values without opening Prisma Studio.

```powershell
# Review the inactive USDA queue. This does not change the database.
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api food-catalog:usda:list -- --active false --limit 100
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

Future work may add a protected admin-only source update job and source release tracking. It must retain the inactive-by-default boundary.
