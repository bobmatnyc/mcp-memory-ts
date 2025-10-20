/**
 * OAuth 2.0 Dynamic Client Registration Endpoint
 * RFC 7591: OAuth 2.0 Dynamic Client Registration Protocol
 *
 * Allows MCP clients (like Claude.AI) to register themselves dynamically
 * without manual credential generation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateClientCredentials, hashSecret } from '@/lib/oauth';
import { getDatabase } from '@/lib/database';

interface ClientRegistrationRequest {
  redirect_uris: string[];
  client_name?: string;
  scope?: string;
  grant_types?: string[];
  response_types?: string[];
  token_endpoint_auth_method?: string;
}

interface ClientRegistrationResponse {
  client_id: string;
  client_secret: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  client_id_issued_at: number;
  client_secret_expires_at: number;
}

export async function POST(req: NextRequest) {
  try {
    const body: ClientRegistrationRequest = await req.json();

    // Validate required fields
    if (!body.redirect_uris || !Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
      return NextResponse.json(
        {
          error: 'invalid_redirect_uri',
          error_description: 'At least one redirect_uri is required',
        },
        { status: 400 }
      );
    }

    // Validate redirect URIs format
    for (const uri of body.redirect_uris) {
      try {
        const url = new URL(uri);
        // For MCP, allow https://claude.ai/* or http://localhost/*
        if (
          !url.href.startsWith('https://claude.ai/') &&
          !url.href.startsWith('http://localhost') &&
          !url.href.startsWith('https://')
        ) {
          return NextResponse.json(
            {
              error: 'invalid_redirect_uri',
              error_description: `Invalid redirect URI: ${uri}. Must use HTTPS or localhost.`,
            },
            { status: 400 }
          );
        }
      } catch (e) {
        return NextResponse.json(
          {
            error: 'invalid_redirect_uri',
            error_description: `Malformed redirect URI: ${uri}`,
          },
          { status: 400 }
        );
      }
    }

    // Set defaults for optional fields
    const clientName = body.client_name || 'MCP Client (Auto-registered)';
    const grantTypes = body.grant_types || ['authorization_code', 'refresh_token'];
    const responseTypes = body.response_types || ['code'];
    const tokenEndpointAuthMethod = body.token_endpoint_auth_method || 'client_secret_post';

    // Parse requested scopes or use defaults
    const requestedScopes = body.scope ? body.scope.split(' ') : [
      'memories:read',
      'memories:write',
      'entities:read',
      'entities:write',
    ];

    // Generate client credentials
    const { clientId, clientSecret } = await generateClientCredentials();
    const secretHash = await hashSecret(clientSecret);

    // Store in database
    const db = await getDatabase();

    // For auto-registration, we need a system user ID
    // Check if a system user exists, or use a placeholder
    const systemUserResult = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: ['system@mcp-memory.internal'],
    });

    let systemUserId: string;

    if (systemUserResult.rows.length === 0) {
      // Create system user for auto-registered clients
      const userId = crypto.randomUUID();
      await db.execute({
        sql: `INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)`,
        args: [userId, 'system@mcp-memory.internal', new Date().toISOString()],
      });
      systemUserId = userId;
    } else {
      systemUserId = systemUserResult.rows[0].id as string;
    }

    // Insert client
    await db.execute({
      sql: `INSERT INTO oauth_clients (
        client_id,
        client_secret_hash,
        name,
        redirect_uris,
        allowed_scopes,
        created_at,
        created_by,
        is_active,
        metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        clientId,
        secretHash,
        clientName,
        JSON.stringify(body.redirect_uris),
        JSON.stringify(requestedScopes),
        new Date().toISOString(),
        systemUserId,
        1,
        JSON.stringify({
          auto_registered: true,
          grant_types: grantTypes,
          response_types: responseTypes,
          token_endpoint_auth_method: tokenEndpointAuthMethod,
          user_agent: req.headers.get('user-agent') || 'unknown',
        }),
      ],
    });

    // Build response per RFC 7591
    const issuedAt = Math.floor(Date.now() / 1000);
    const response: ClientRegistrationResponse = {
      client_id: clientId,
      client_secret: clientSecret,
      client_name: clientName,
      redirect_uris: body.redirect_uris,
      grant_types: grantTypes,
      response_types: responseTypes,
      token_endpoint_auth_method: tokenEndpointAuthMethod,
      client_id_issued_at: issuedAt,
      client_secret_expires_at: 0, // 0 means never expires
    };

    console.log(`[OAuth DCR] Registered new client: ${clientId} (${clientName})`);

    return NextResponse.json(response, {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('[OAuth DCR] Registration error:', error);
    return NextResponse.json(
      {
        error: 'server_error',
        error_description: 'Failed to register client',
      },
      { status: 500 }
    );
  }
}
