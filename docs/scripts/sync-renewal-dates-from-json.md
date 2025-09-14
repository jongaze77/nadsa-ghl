# Sync Renewal Dates from JSON Script

This script extracts renewal dates from the `customFields` JSON column and updates the `renewal_date` field in the Contact table. This is particularly useful after running reconciliation processes to ensure data exports work properly.

## What it does

1. **Finds contacts** with `customFields` data containing renewal dates
2. **Extracts renewal dates** from the `cWMPNiNAfReHOumOhBB2` field in the JSON
3. **Updates the `renewal_date` column** in the Contact table
4. **Validates dates** to ensure they're in the correct format
5. **Preserves existing data** - only updates if the dates are different

## Usage

### Basic Usage

```bash
# Dry run (shows what would be changed without making changes)
npm run sync-renewal-dates-from-json -- --dry-run

# Actually sync the renewal dates
npm run sync-renewal-dates-from-json
```

### Advanced Options

```bash
# Dry run with limit (process only first 10 contacts)
npm run sync-renewal-dates-from-json -- --dry-run --limit=10

# Sync specific contact only
npm run sync-renewal-dates-from-json -- --contact=CONTACT_ID_HERE

# Combine options
npm run sync-renewal-dates-from-json -- --dry-run --limit=5
```

## Command Line Arguments

| Argument | Description |
|----------|-------------|
| `--dry-run` or `-d` | Preview changes without making them |
| `--limit=N` | Limit processing to first N contacts |
| `--contact=ID` | Process only the specified contact ID |
| `--help` or `-h` | Show help message |

## Safety Features

- **Dry Run Mode**: Always test with `--dry-run` first to preview changes
- **3-second delay**: In live mode, gives you time to cancel with Ctrl+C
- **Date validation**: Ensures only valid dates are processed
- **Graceful error handling**: Continues processing if individual contacts fail
- **Skip if already correct**: Only updates if the renewal_date differs from JSON

## Example Output

```
📋 Sync Renewal Dates from JSON Script
=======================================
Mode: DRY RUN
Limit: 5 contacts
=======================================

⚠️  DRY RUN MODE - No actual changes will be made

📋 Starting renewal date sync from customFields JSON...
📊 Found 5 contacts with customFields data (limited to 5)

👤 Processing: John Smith (abc123)
   Current renewal_date: null
   JSON renewal date: 2025-12-31
   📅 Will update: "null" -> "2025-12-31"
   🔍 Would update renewal_date to 2025-12-31 (DRY RUN)

👤 Processing: Jane Doe (def456)
   Current renewal_date: 2025-12-31
   JSON renewal date: 2025-12-31
   ✅ Already correct - renewal_date matches JSON date

📊 SYNC SUMMARY
================
📋 Total contacts processed: 5
✅ Successfully updated: 3
✅ Already correct: 1
ℹ️  No change needed: 1
❌ Errors: 0

🔍 DRY RUN: Would sync 3 renewal dates from JSON to database field
```

## Supported JSON Formats

The script handles both formats of customFields JSON:

### Array Format
```json
[
  {
    "id": "cWMPNiNAfReHOumOhBB2",
    "value": "2025-12-31"
  }
]
```

### Object Format
```json
{
  "cWMPNiNAfReHOumOhBB2": "2025-12-31"
}
```

## Date Validation

- **Accepts various formats**: ISO dates, MM/DD/YYYY, DD/MM/YYYY, etc.
- **Normalizes output**: Always stores in YYYY-MM-DD format
- **Validates dates**: Ensures dates are valid and not malformed
- **Handles edge cases**: Skips empty, null, or invalid date strings

## Use Cases

### After Reconciliation Process
If you've just completed reconciliation but the `renewal_date` field wasn't updated:

```bash
# Check what would be updated
npm run sync-renewal-dates-from-json -- --dry-run

# Actually sync the dates
npm run sync-renewal-dates-from-json
```

### Data Export Preparation
Before running data exports that depend on the `renewal_date` field:

```bash
npm run sync-renewal-dates-from-json
```

### Single Contact Fix
If you need to fix a specific contact's renewal date:

```bash
npm run sync-renewal-dates-from-json -- --contact=CONTACT_ID
```

## Troubleshooting

### Common Issues

1. **No contacts found**: Ensure contacts have `customFields` data with renewal dates
2. **Date format errors**: The script will skip invalid dates and report them
3. **Permission errors**: Ensure you have proper database access

### Environment Variables Required

```bash
DATABASE_URL=postgresql://...
```

## Recovery

This script only updates the `renewal_date` field based on existing JSON data. It doesn't modify the JSON or any other fields, so it's safe to run multiple times.

If you need to undo changes, you can:
1. Restore from a database backup, or
2. Set `renewal_date` back to NULL using the clear-renewal-dates script

**Always test with `--dry-run` first!**