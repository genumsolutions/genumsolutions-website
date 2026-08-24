// Shared helper: two-letter avatar initials from a name or email.
export function initials(nameOrEmail: string) {
  const parts = String(nameOrEmail || '?').trim().split(/[\s@._-]+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]!.toUpperCase()).join('') || '?'
}
