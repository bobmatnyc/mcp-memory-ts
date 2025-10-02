# Schema Optimization Migration - Quick Start Guide

**⚡ Fast Track: Get Started in 2 Minutes**

---

## 🚀 One-Line Quick Start

```bash
# Backup → Preview → Migrate → Verify
turso db shell <your-db> ".backup backup.db" && \
npm run migrate:schema:dry-run && \
npm run migrate:schema && \
npm run verify:schema
```

---

## 📋 3-Step Process

### Step 1: Backup (30 seconds)

```bash
# REQUIRED - Always backup first!
turso db shell <your-database-name> ".backup backup-$(date +%Y%m%d).db"
```

### Step 2: Migrate (2 minutes)

```bash
# Preview what will change
npm run migrate:schema:dry-run

# Apply all optimizations
npm run migrate:schema

# Or apply in phases:
npm run migrate:schema:phase1  # Low-risk first
npm run migrate:schema:phase2  # Then schema fixes
```

### Step 3: Verify (30 seconds)

```bash
# Run 17 automated tests
npm run verify:schema

# Check results
npm run migrate:schema:stats
```

---

## 🎯 What This Does

| Change | Before | After | Benefit |
|--------|--------|-------|---------|
| Tables | 9 | 8 | Remove unused learned_patterns |
| Indexes | 23 | 11 | 52% reduction, +20% write speed |
| api_key | Column name mismatch | Fixed to api_key_hash | Code/schema aligned |

**Total Time:** 5-10 minutes
**Risk Level:** 🟢 Low (with backups)
**Downtime:** < 1 minute

---

## 🔧 Common Commands

```bash
# PREVIEW (recommended first)
npm run migrate:schema:dry-run

# MIGRATE
npm run migrate:schema              # Full migration
npm run migrate:schema:phase1       # Safe optimizations only
npm run migrate:schema:phase2       # Schema consistency fixes

# VERIFY
npm run verify:schema               # Run tests
npm run verify:schema:info          # Show details
npm run migrate:schema:stats        # Database stats

# ROLLBACK (if needed)
npm run migrate:schema:rollback     # Undo all changes
```

---

## ⚠️ Before You Start

### ✅ Pre-Flight Checklist

- [ ] Database backup created
- [ ] Tested in development environment
- [ ] Read SCHEMA_OPTIMIZATION_GUIDE.md (optional but recommended)
- [ ] Have 10 minutes available
- [ ] Can stop application if needed (production)

### 🚫 Don't Run If:

- No database backup
- Production without testing in dev first
- Not sure what this does
- During peak traffic (for production)

---

## 🆘 Troubleshooting

### Migration Failed?

```bash
# Rollback immediately
npm run migrate:schema:rollback

# Or restore from backup
turso db shell <database> ".restore backup.db"
```

### Verification Failed?

```bash
# Check what failed
npm run verify:schema

# Get detailed info
npm run verify:schema:info

# Compare with expected
npm run migrate:schema:stats
```

### Need Help?

1. Check error message in terminal
2. Review SCHEMA_OPTIMIZATION_GUIDE.md
3. Run verification: `npm run verify:schema:info`
4. Rollback if uncertain: `npm run migrate:schema:rollback`

---

## 📖 Full Documentation

- **SCHEMA_OPTIMIZATION_GUIDE.md** - Complete step-by-step guide (15 pages)
- **SCHEMA_OPTIMIZATION_SUMMARY.md** - Implementation details
- **DATABASE_SCHEMA_ANALYSIS.md** - Original analysis

---

## 🎉 Success Indicators

After migration, you should see:

```
✅ All 17 verification tests passed
✅ Tables: 8 (was 9)
✅ Indexes: 11 (was 23)
✅ api_key_hash column exists
✅ learned_patterns table removed
```

**All done!** Your schema is now optimized. 🚀

---

## 🔄 Rollback Instructions

If anything goes wrong:

```bash
# Option 1: Automated rollback
npm run migrate:schema:rollback

# Option 2: Restore backup
turso db shell <database> ".restore backup.db"

# Option 3: Specific phase
npm run migrate:schema:rollback -- --phase="Phase 1"
```

---

## 💡 Pro Tips

1. **Always backup first** - Cannot be stressed enough
2. **Test in dev** - Before touching production
3. **Use dry-run** - Preview changes safely
4. **Phase by phase** - If cautious, run phase1 then phase2
5. **Monitor logs** - Watch for errors during migration

---

## 📊 Expected Results

### Before Migration
```
Tables: 9 (1 unused)
Indexes: 23 (12 redundant)
Schema: api_key ❌ (code expects api_key_hash)
```

### After Migration
```
Tables: 8 ✅
Indexes: 11 ✅ (all necessary)
Schema: api_key_hash ✅ (matches code)
Performance: +20% faster writes ✅
```

---

## ⏱️ Time Estimates

| Environment | Backup | Migration | Verify | Total |
|-------------|--------|-----------|--------|-------|
| Development | 10s | 1min | 30s | 2min |
| Staging | 30s | 2min | 1min | 4min |
| Production | 1min | 3min | 2min | 6min |

---

## 🚦 Risk Assessment

| Phase | Risk | Can Rollback? | Downtime |
|-------|------|---------------|----------|
| Phase 1 | 🟢 Low | ✅ Yes | None |
| Phase 2 | 🟡 Medium | ✅ Yes | Seconds |
| Overall | 🟢 Low | ✅ Yes | < 1min |

---

**Ready? Let's go! 🚀**

```bash
# Copy-paste this entire block:
echo "🔐 Creating backup..."
turso db shell <YOUR-DATABASE-NAME> ".backup backup-$(date +%Y%m%d-%H%M%S).db"

echo "👀 Previewing changes..."
npm run migrate:schema:dry-run

echo "⚡ Running migration..."
npm run migrate:schema

echo "✅ Verifying results..."
npm run verify:schema

echo "🎉 Done! Check output above for success."
```

*Replace `<YOUR-DATABASE-NAME>` with your actual database name*
