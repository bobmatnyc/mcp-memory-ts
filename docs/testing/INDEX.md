# Testing & QA Documentation Index

This directory contains all testing, quality assurance, and verification documentation for the MCP Memory TypeScript project.

## Test Reports & Verification

### Critical Bug Fixes
- [CRITICAL_BUG_FIX_REPORT.md](./CRITICAL_BUG_FIX_REPORT.md) - Critical bug fix documentation
- [NULL_ID_FIX_FINAL_REPORT.md](./NULL_ID_FIX_FINAL_REPORT.md) - NULL ID bug fix final report

### Security Testing
- [SECURITY_VERIFICATION_REPORT.md](./SECURITY_VERIFICATION_REPORT.md) - Security verification results
- [SECURITY_VERIFICATION_PENTEST_PLAN.md](./SECURITY_VERIFICATION_PENTEST_PLAN.md) - Penetration testing plan

### Feature Testing

#### OAuth & Authentication
- [OAUTH_TEST_INSTRUCTIONS.md](./OAUTH_TEST_INSTRUCTIONS.md) - OAuth testing procedures
- [OAUTH_VERIFICATION_REPORT.md](./OAUTH_VERIFICATION_REPORT.md) - OAuth verification results
- [OAUTH_VERIFICATION_SUMMARY.md](./OAUTH_VERIFICATION_SUMMARY.md) - OAuth verification summary

#### Google Integration
- [GOOGLE_OAUTH_STATUS_FIX_VERIFICATION.md](./GOOGLE_OAUTH_STATUS_FIX_VERIFICATION.md) - Google OAuth status verification
- [GOOGLE_OAUTH_TEST_CHECKLIST.md](./GOOGLE_OAUTH_TEST_CHECKLIST.md) - Google OAuth test checklist
- [GOOGLE_ROUTES_AUDIT_REPORT.md](./GOOGLE_ROUTES_AUDIT_REPORT.md) - Google routes audit

#### Gmail Integration
- [GMAIL_FILTER_TEST_REPORT.md](./GMAIL_FILTER_TEST_REPORT.md) - Gmail filter testing
- [GMAIL_TEST_SUMMARY.md](./GMAIL_TEST_SUMMARY.md) - Gmail testing summary
- [VERIFY_GMAIL_EXTRACTION_FIX.md](./VERIFY_GMAIL_EXTRACTION_FIX.md) - Gmail extraction verification
- [EXTRACTION_RETRY_VERIFICATION.md](./EXTRACTION_RETRY_VERIFICATION.md) - Extraction retry verification

#### Batch Processing
- [BATCH_PROGRESS_TEST_GUIDE.md](./BATCH_PROGRESS_TEST_GUIDE.md) - Batch progress testing guide
- [BATCH_SYNC_TESTING.md](./BATCH_SYNC_TESTING.md) - Batch sync testing procedures

#### Dashboard & UI
- [DASHBOARD_FIX_SUMMARY.md](./DASHBOARD_FIX_SUMMARY.md) - Dashboard fix summary
- [DASHBOARD_FIX_VERIFICATION.md](./DASHBOARD_FIX_VERIFICATION.md) - Dashboard fix verification

### Data Quality & Database

#### Entity Management
- [ENTITY_CLEANUP_FINAL_REPORT.md](./ENTITY_CLEANUP_FINAL_REPORT.md) - Entity cleanup final report
- [ENTITY_CLEANUP_SUMMARY.md](./ENTITY_CLEANUP_SUMMARY.md) - Entity cleanup summary
- [ENTITY_DATABASE_ANALYSIS.md](./ENTITY_DATABASE_ANALYSIS.md) - Entity database analysis
- [ENTITY_REFERENCE_CLEANUP_VERIFICATION.md](./ENTITY_REFERENCE_CLEANUP_VERIFICATION.md) - Entity reference cleanup
- [ENTITY_REFS_CLEANUP_SUMMARY.md](./ENTITY_REFS_CLEANUP_SUMMARY.md) - Entity refs cleanup summary

#### Data Quality
- [DATA_QUALITY_ANALYSIS.md](./DATA_QUALITY_ANALYSIS.md) - Data quality analysis
- [CLEANUP_SUMMARY.md](./CLEANUP_SUMMARY.md) - General cleanup summary
- [IMPORTANCE_COLUMN_INVESTIGATION_REPORT.md](./IMPORTANCE_COLUMN_INVESTIGATION_REPORT.md) - Importance column investigation

### Investigation Reports
- [MEMORY_PAGE_INVESTIGATION_REPORT.md](./MEMORY_PAGE_INVESTIGATION_REPORT.md) - Memory page investigation

### General Verification
- [VERIFICATION_REPORT.md](./VERIFICATION_REPORT.md) - General verification report
- [QUICK_START_TESTING.md](./QUICK_START_TESTING.md) - Quick start testing guide

## Related Testing Documentation

- [Pre-deployment Checklist](../development/VERIFICATION_CHECKLIST.md) - Comprehensive pre-deployment checks
- [Test Results](../development/TEST_RESULTS.md) - Detailed test results
- [Test Report](../development/TEST-REPORT.md) - Historical test report

## Test Scripts

Test automation scripts are located in `/scripts/test/`:
- `TEST_ALL_GOOGLE_ROUTES.sh` - Test all Google API routes
- `TEST_GOOGLE_STATUS_FIX.sh` - Test Google status fix
- `TEST_GOOGLE_SYNC_OPTIMIZATION.sh` - Test sync optimization
- `TEST_OAUTH_AFTER_COMPLETE.sh` - Test OAuth after completion
- `test-security-fixes.sh` - Security fixes test suite
- `test-sync-with-logs.sh` - Sync with logging tests
- `VERIFY_SECURITY_FIXES.sh` - Security verification script

## Running Tests

### Quick Test Suite
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Pre-deployment validation
npm run pre-deploy
```

### Manual Testing
```bash
# Test specific features
cd scripts/test
./TEST_ALL_GOOGLE_ROUTES.sh
./test-security-fixes.sh
```

## Test Coverage

Current test coverage: **95.2%** (20/21 tests passing)

### Coverage by Component
- Core memory operations: ✅ Complete
- Database operations: ✅ Complete
- MCP protocol: ✅ Complete
- Google integration: ✅ Complete
- OAuth flows: ✅ Complete

## Quality Standards

- **Unit Tests**: >80% coverage required
- **Integration Tests**: All critical paths covered
- **Regression Tests**: Run before every deployment
- **Security Tests**: Regular penetration testing

---

**Last Updated**: 2025-10-20
**Test Framework**: Vitest
**Coverage Goal**: 95%+ for production code
