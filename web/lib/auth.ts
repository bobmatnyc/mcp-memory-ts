import { auth, currentUser } from '@clerk/nextjs/server';
import { getUserCredentials } from './user-metadata';
import { Database } from './database';

export async function getUserEmail(): Promise<string> {
  const { userId } = auth();

  if (!userId) {
    throw new Error('Unauthorized - please sign in');
  }

  const user = await currentUser();

  if (!user || !user.emailAddresses || user.emailAddresses.length === 0) {
    throw new Error('User email not found');
  }

  const userEmail = user.emailAddresses[0].emailAddress;

  return userEmail;
}

/**
 * Get a Database instance configured with user-specific credentials from Clerk metadata
 * @returns Database instance
 */
export async function getDatabase(): Promise<Database> {
  const { userId } = auth();

  if (!userId) {
    throw new Error('Unauthorized - please sign in');
  }

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;

  if (!email) {
    throw new Error('User email not found');
  }

  // Get user's credentials from Clerk metadata
  const credentials = await getUserCredentials(userId);

  if (!credentials?.tursoUrl || !credentials?.tursoAuthToken) {
    throw new Error('User credentials not configured. Please visit /settings to configure your database credentials.');
  }

  // Create database with user's credentials
  const database = new Database({
    url: credentials.tursoUrl,
    authToken: credentials.tursoAuthToken,
  });

  // Ensure user exists in their database
  try {
    const name = user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.firstName || email.split('@')[0];
    await database.ensureUser(email, name);
  } catch (error) {
    console.error('Failed to ensure user exists:', error);
  }

  return database;
}
