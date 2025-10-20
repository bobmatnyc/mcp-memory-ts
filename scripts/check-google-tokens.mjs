import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

try {
  const result = await client.execute({
    sql: 'SELECT id, email, metadata FROM users WHERE email = ?',
    args: ['bob@matsuoka.com']
  });
  
  if (result.rows && result.rows.length > 0) {
    const user = result.rows[0];
    console.log('User:', user.id, user.email);
    
    if (user.metadata) {
      const metadata = typeof user.metadata === 'string' ? JSON.parse(user.metadata) : user.metadata;
      console.log('Metadata keys:', Object.keys(metadata));
      
      if (metadata.googleOAuthTokens) {
        const tokens = metadata.googleOAuthTokens;
        console.log('Google OAuth Tokens found');
        console.log('Has access_token:', !!tokens.access_token);
        console.log('Has refresh_token:', !!tokens.refresh_token);
        console.log('Scope:', tokens.scope);
        console.log('Expiry date:', tokens.expiry_date);
        
        if (tokens.expiry_date) {
          const expiryMs = typeof tokens.expiry_date === 'number' ? tokens.expiry_date : Date.parse(tokens.expiry_date);
          const now = Date.now();
          const isExpired = expiryMs < now;
          console.log('IS EXPIRED:', isExpired);
          
          if (isExpired) {
            const diffMinutes = Math.floor((now - expiryMs) / 1000 / 60);
            console.log('Expired minutes ago:', diffMinutes);
          } else {
            const diffMinutes = Math.floor((expiryMs - now) / 1000 / 60);
            console.log('Expires in minutes:', diffMinutes);
          }
        }
      } else {
        console.log('No googleOAuthTokens found');
      }
    }
  } else {
    console.log('User not found');
  }
} catch (error) {
  console.error('Error:', error.message);
}
