/**
 * Clerk Webhook Handler for User Management
 * Handles user creation, updates, and deletion events from Clerk
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Webhook } from 'svix';
import { initDatabaseFromEnv } from '../../src/database/index.js';
import { MemoryCore } from '../../src/core/index.js';

interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses: Array<{
      email_address: string;
      verification?: { status: string };
    }>;
    first_name?: string;
    last_name?: string;
    created_at?: number;
    updated_at?: number;
  };
}

let memoryCore: MemoryCore | null = null;

async function getMemoryCore(): Promise<MemoryCore> {
  if (!memoryCore) {
    const db = initDatabaseFromEnv();
    memoryCore = new MemoryCore(db, process.env.OPENAI_API_KEY);
    await memoryCore.initialize();
  }
  return memoryCore;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify webhook signature
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('Missing CLERK_WEBHOOK_SECRET');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    const svix_id = req.headers['svix-id'] as string;
    const svix_timestamp = req.headers['svix-timestamp'] as string;
    const svix_signature = req.headers['svix-signature'] as string;

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return res.status(400).json({ error: 'Missing svix headers' });
    }

    const wh = new Webhook(webhookSecret);
    const payload = JSON.stringify(req.body);

    let evt: ClerkWebhookEvent;
    try {
      evt = wh.verify(payload, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      }) as ClerkWebhookEvent;
    } catch (err) {
      console.error('Webhook verification failed:', err);
      return res.status(400).json({ error: 'Webhook verification failed' });
    }

    // Handle different event types
    const mc = await getMemoryCore();

    switch (evt.type) {
      case 'user.created':
        await handleUserCreated(mc, evt.data);
        break;

      case 'user.updated':
        await handleUserUpdated(mc, evt.data);
        break;

      case 'user.deleted':
        await handleUserDeleted(mc, evt.data);
        break;

      default:
        console.log(`Unhandled webhook event type: ${evt.type}`);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleUserCreated(mc: MemoryCore, userData: ClerkWebhookEvent['data']) {
  try {
    const primaryEmail = userData.email_addresses.find(
      email => email.verification?.status === 'verified'
    ) || userData.email_addresses[0];

    if (!primaryEmail?.email_address) {
      console.error('No valid email address found for user:', userData.id);
      return;
    }

    const result = await mc.createUser({
      id: userData.id,
      email: primaryEmail.email_address,
      name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || undefined,
      isActive: true,
      createdAt: userData.created_at ? new Date(userData.created_at).toISOString() : new Date().toISOString(),
    });

    if (result.status === 'success') {
      console.log(`User created successfully: ${userData.id}`);
    } else {
      console.error(`Failed to create user: ${result.error}`);
    }
  } catch (error) {
    console.error('Error creating user:', error);
  }
}

async function handleUserUpdated(mc: MemoryCore, userData: ClerkWebhookEvent['data']) {
  try {
    const primaryEmail = userData.email_addresses.find(
      email => email.verification?.status === 'verified'
    ) || userData.email_addresses[0];

    if (!primaryEmail?.email_address) {
      console.error('No valid email address found for user:', userData.id);
      return;
    }

    // Update user information
    // Note: You'll need to implement updateUser method in MemoryCore
    console.log(`User updated: ${userData.id}`);

    // For now, we'll just log the update
    // In production, you'd implement proper user update logic
  } catch (error) {
    console.error('Error updating user:', error);
  }
}

async function handleUserDeleted(mc: MemoryCore, userData: ClerkWebhookEvent['data']) {
  try {
    // Handle user deletion
    // Note: You'll need to implement user deletion logic in MemoryCore
    console.log(`User deleted: ${userData.id}`);

    // In production, you'd implement proper user cleanup:
    // - Mark user as inactive
    // - Optionally delete user data (following GDPR requirements)
    // - Clean up associated memories and entities
  } catch (error) {
    console.error('Error deleting user:', error);
  }
}