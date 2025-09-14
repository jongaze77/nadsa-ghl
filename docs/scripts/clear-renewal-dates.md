# Clear Renewal Dates Script

This script clears renewal date information from both the PostgreSQL database and GoHighLevel (GHL) system.

## What it does

1. **Database Updates**:
   - Sets `renewal_date` field to `NULL` in the Contact table
   - Removes `cWMPNiNAfReHOumOhBB2` from the `customFields` JSON column

2. **GHL Updates**:
   - Clears the `cWMPNiNAfReHOumOhBB2` custom field by setting it to empty string

## Usage

### Basic Usage

```bash
# Dry run (shows what would be changed without making changes)
npm run clear-renewal-dates -- --dry-run

# Actually clear the renewal dates
npm run clear-renewal-dates
```

### Advanced Options

```bash
# Dry run with limit (process only first 10 contacts)
npm run clear-renewal-dates -- --dry-run --limit=10

# Clear specific contact only
npm run clear-renewal-dates -- --contact=CONTACT_ID_HERE

# Update database only (skip GHL)
npm run clear-renewal-dates -- --db-only

# Update GHL only (skip database)
npm run clear-renewal-dates -- --ghl-only

# Combine options
npm run clear-renewal-dates -- --dry-run --limit=5 --db-only
```

## Command Line Arguments

| Argument | Description |
|----------|-------------|
| `--dry-run` or `-d` | Preview changes without making them |
| `--limit=N` | Limit processing to first N contacts |
| `--contact=ID` | Process only the specified contact ID |
| `--db-only` | Only update database, skip GHL updates |
| `--ghl-only` | Only update GHL, skip database updates |

## Safety Features

- **Dry Run Mode**: Always test with `--dry-run` first to preview changes
- **3-second delay**: In live mode, gives you time to cancel with Ctrl+C
- **Graceful shutdown**: Handles Ctrl+C interruption cleanly
- **Rate limiting**: Adds delays between GHL API calls to avoid rate limits
- **Error handling**: Continues processing other contacts if one fails

## Example Output

```
🚀 Clear Renewal Dates Script
=====================================
Mode: DRY RUN
Limit: 5 contacts
=====================================

⚠️  DRY RUN MODE - No actual changes will be made

🗄️  Starting database renewal date clearing...
📊 Found 12 contacts with renewal date data
🎯 Processing 5 contacts (limited to 5)

👤 Processing contact: John Smith (abc123)
   Current renewal_date: 2024-12-31
   Has renewal in customFields: true
   🔍 Would update database (DRY RUN)

🌐 Starting GHL renewal date clearing...
📋 Processing 5 contacts in GHL (limited to 5)

🌐 Processing GHL contact: John Smith (abc123)
[GHL] Processing contact abc123 (DRY RUN)
[GHL] Contact abc123: Found renewal date "2024-12-31", clearing it
[GHL] Contact abc123: Would clear renewal date "2024-12-31" (DRY RUN)

📊 GHL update summary:
   ✅ Successful: 5
   ❌ Failed: 0

🎉 Script completed successfully!
```

## Troubleshooting

### Common Issues

1. **Permission errors**: Ensure you have proper database and GHL API access
2. **Rate limiting**: If you get GHL rate limit errors, the script includes built-in delays
3. **Network errors**: GHL API calls have automatic retry logic with exponential backoff

### Environment Variables Required

```bash
DATABASE_URL=postgresql://...
GHL_API_KEY=your_api_key
GHL_LOCATION_ID=your_location_id
```

## Recovery

If you need to restore renewal dates after running this script, you would need to:
1. Restore from a database backup, or
2. Re-sync with GHL if the renewal dates still exist there, or  
3. Manually re-enter the renewal date information

**Always test with `--dry-run` first!**