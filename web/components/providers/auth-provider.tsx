// This file is no longer needed with Clerk
// ClerkProvider is now used directly in the root layout
// Keeping this file for backwards compatibility if needed

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
