# Remote MCP Server - Verification Checklist

Use this checklist to verify the remote MCP server implementation is working correctly.

## ✅ Build & Tests

- [x] TypeScript compilation succeeds
  ```bash
  npm run build
  ```

- [x] Type checking passes
  ```bash
  npm run type-check
  ```

- [x] Integration tests pass (15/15)
  ```bash
  npm test -- remote-mcp-auth.test.ts --run
  ```

## 📋 Pre-Deployment Checklist

### Environment Configuration

- [ ] Copy `.env.example` to `.env`
- [ ] Set `TURSO_URL` to your database URL
- [ ] Set `TURSO_AUTH_TOKEN` to your database auth token
- [ ] Set `OPENAI_API_KEY` to your OpenAI API key
- [ ] Set `CLERK_SECRET_KEY` (development or production)
- [ ] Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- [ ] Optionally set `REMOTE_MCP_PORT` (default: 3001)
- [ ] Optionally set `CORS_ORIGIN` (default: *)

### Clerk Configuration

- [ ] Create or have access to a Clerk account
- [ ] For development: Use test keys from `.env.example`
- [ ] For production: Use live keys (uncomment in `.env`)
- [ ] Verify keys are correct in Clerk dashboard

## 🧪 Local Testing

### 1. Start the Remote MCP Server

```bash
npm run mcp-server-remote
```

Expected output:
```
Remote MCP server listening on 0.0.0.0:3001
```

### 2. Test Health Endpoint

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-01T...",
  "service": "remote-mcp-server",
  "activeSessions": 0
}
```

### 3. Test Authentication (should fail without token)

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"ping"}'
```

Expected response:
```json
{
  "jsonrpc": "2.0",
  "id": null,
  "error": {
    "code": -32001,
    "message": "Authentication required",
    "data": { "reason": "Missing or invalid Authorization header" }
  }
}
```

### 4. Test with Clerk Token (requires valid token)

```bash
# Get a token from Clerk first, then:
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

Expected: JSON response with list of 8 tools

## 🚀 Deployment Verification

### Vercel Deployment

- [ ] Run `npm run deploy:vercel` or deploy via Vercel dashboard
- [ ] Set environment variables in Vercel dashboard:
  - `TURSO_URL`
  - `TURSO_AUTH_TOKEN`
  - `OPENAI_API_KEY`
  - `CLERK_SECRET_KEY` (production)
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (production)
- [ ] Test health endpoint: `https://your-app.vercel.app/api/mcp/health`
- [ ] Test authenticated request with Clerk token

### Alternative Deployment (Docker/Cloud)

- [ ] Build: `npm run build`
- [ ] Test: `npm run test`
- [ ] Deploy built files from `dist/`
- [ ] Set environment variables on hosting platform
- [ ] Test health and authenticated endpoints

## 🔒 Security Verification

### Authentication

- [ ] Requests without Authorization header are rejected
- [ ] Requests with invalid tokens are rejected
- [ ] Valid Clerk tokens are accepted
- [ ] Sessions expire after 1 hour
- [ ] Auth failures are logged

### User Isolation

- [ ] Create memory as User A
- [ ] Verify User B cannot access User A's memory
- [ ] Verify each user only sees their own data
- [ ] Check database has correct `user_id` filtering

### Error Messages

- [ ] Error messages don't expose sensitive data
- [ ] Stack traces are not shown to clients
- [ ] Authentication errors are generic

## 📊 Functionality Verification

### MCP Tools

Test each tool with a valid Clerk token:

- [ ] `store_memory` - Store a memory
- [ ] `recall_memories` - Search memories
- [ ] `get_memory` - Get specific memory
- [ ] `update_memory` - Update a memory
- [ ] `delete_memory` - Delete a memory
- [ ] `get_memory_stats` - Get statistics
- [ ] `update_missing_embeddings` - Generate embeddings
- [ ] `get_daily_costs` - Get cost report

### Example Client

- [ ] Run example client: `tsx examples/remote-mcp-client.ts`
- [ ] Verify all operations work
- [ ] Check memories are stored with correct user_id

## 📈 Performance & Monitoring

### Performance

- [ ] Response times are acceptable (< 1s for most operations)
- [ ] Embedding generation doesn't block requests
- [ ] Database queries are fast
- [ ] Session management doesn't leak memory

### Monitoring

- [ ] Server logs show authentication events
- [ ] Failed auth attempts are logged
- [ ] Tool calls are logged with user email
- [ ] Errors are properly logged

## 🔄 Backward Compatibility

### Existing Functionality

- [ ] stdio MCP server still works: `npm run mcp-server`
- [ ] REST API still works: `npm run api-server`
- [ ] Database schema unchanged
- [ ] Existing tests still pass: `npm test`
- [ ] No breaking changes to core functionality

## 📚 Documentation

- [ ] `REMOTE_MCP_SETUP.md` is complete and accurate
- [ ] `IMPLEMENTATION_SUMMARY.md` reflects actual implementation
- [ ] `README.md` includes remote MCP server section
- [ ] Example client code is documented
- [ ] Environment variables are documented in `.env.example`

## 🎯 Final Verification

### User Journey

1. [ ] User authenticates with Clerk
2. [ ] User gets session token
3. [ ] User makes MCP request with token
4. [ ] Server validates token with Clerk
5. [ ] Server processes request for user
6. [ ] Server returns response
7. [ ] User's data is isolated from other users

### Production Readiness

- [ ] All tests pass
- [ ] Build succeeds without warnings
- [ ] Type checking passes
- [ ] Environment variables configured
- [ ] Clerk production keys set
- [ ] Database configured and accessible
- [ ] Monitoring/logging configured
- [ ] CORS configured appropriately
- [ ] Rate limiting considered
- [ ] Quotas configured

## ✅ Sign-Off

**Implementation Complete**: [ ]
**All Tests Passing**: [x]
**Documentation Complete**: [x]
**Ready for Production**: [ ] (requires Clerk setup and testing)

---

**Notes:**
- Items marked [x] are verified as working
- Items marked [ ] require manual verification or configuration
- For full production deployment, complete all unchecked items
