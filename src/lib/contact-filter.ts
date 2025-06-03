// src/lib/contact-filter.ts

/**
 * Fuzzy string match (case-insensitive substring)
 */
export function fuzzyMatch(str: string, query: string): boolean {
    return str.toLowerCase().includes(query.toLowerCase());
  }
  
  /**
   * Normalize membership type string for consistent comparisons
   */
  export function normalizeMembershipType(mt: string | null | undefined): string {
    if (!mt) return '';
    return mt.trim().toLowerCase().replace(/member$/i, '').trim();
  }
  
  /**
   * Determine if a membership type string qualifies as a member
   */
  export function isMember(mt: string | null | undefined): boolean {
    const normal = normalizeMembershipType(mt);
    return (
      normal.startsWith('full') ||
      normal.startsWith('associate') ||
      normal.startsWith('newsletter') ||
      normal.startsWith('ex')
    );
  }
  
  /**
   * Sort contacts: lastName > firstName > contactName > email
   */
  export function sortContacts(a: any, b: any): number {
    return  (a.lastName  || '').localeCompare(b.lastName  || '', 'en', {sensitivity:'base'}) ||
            (a.firstName || '').localeCompare(b.firstName || '', 'en', {sensitivity:'base'}) ||
            (a.contactName||'').localeCompare(b.contactName||'', 'en', {sensitivity:'base'}) ||
            (a.email      || '').localeCompare(b.email      || '', 'en', {sensitivity:'base'});
  }