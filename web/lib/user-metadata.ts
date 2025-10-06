import { clerkClient } from '@clerk/nextjs/server';

export interface UserMetadata {
  tursoUrl?: string;
  tursoAuthToken?: string;
  openaiApiKey?: string;
}

/**
 * Get user credentials from Clerk user metadata
 * @param userId - Clerk user ID
 * @returns User metadata with credentials or null if not found
 */
export async function getUserCredentials(userId: string): Promise<UserMetadata | null> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return (user.publicMetadata as UserMetadata) || null;
  } catch (error) {
    console.error('Failed to get user credentials:', error);
    return null;
  }
}

/**
 * Update user credentials in Clerk user metadata
 * @param userId - Clerk user ID
 * @param credentials - Partial credentials to update
 */
export async function updateUserCredentials(
  userId: string,
  credentials: Partial<UserMetadata>
): Promise<void> {
  const client = await clerkClient();
  await client.users.updateUser(userId, {
    publicMetadata: credentials,
  });
}

/**
 * Check if user has all required credentials configured
 * @param userId - Clerk user ID
 * @returns true if all credentials are configured
 */
export async function hasRequiredCredentials(userId: string): Promise<boolean> {
  const credentials = await getUserCredentials(userId);
  return !!(
    credentials?.tursoUrl &&
    credentials?.tursoAuthToken &&
    credentials?.openaiApiKey
  );
}
