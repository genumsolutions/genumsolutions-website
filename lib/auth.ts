// Shared client-side sign-out. Callers are responsible for clearing local
// cart state via the cart provider before invoking this.
export async function signOut(redirectTo = '/') {
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } catch {
    // Network failure should not trap the user on this page.
  } finally {
    window.location.href = redirectTo
  }
}
