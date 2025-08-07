import { prisma } from '@/lib/prisma';

// Configuration constants for brute-force protection
const MAX_FAILED_ATTEMPTS = parseInt(process.env.MAX_FAILED_ATTEMPTS || '5');
const LOCKOUT_DURATION_MINUTES = parseInt(process.env.LOCKOUT_DURATION_MINUTES || '15');

export class AuthService {
  /**
   * Check if an account is currently locked
   * @param username The username to check
   * @returns Promise<boolean> True if account is locked
   */
  static async isAccountLocked(username: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { username },
        select: { lockedUntil: true }
      });

      if (!user || !user.lockedUntil) {
        return false;
      }

      // Check if lockout period has expired
      const now = new Date();
      if (user.lockedUntil <= now) {
        // Lockout has expired, reset the lockout
        await this.resetFailedAttempts(username);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking account lock status:', error);
      return false;
    }
  }

  /**
   * Increment failed login attempts for a user
   * @param username The username to increment attempts for
   * @returns Promise<boolean> True if account is now locked
   */
  static async incrementFailedAttempts(username: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { username },
        select: { failedLoginAttempts: true }
      });

      if (!user) {
        // User doesn't exist - don't reveal this information
        return false;
      }

      const newAttempts = user.failedLoginAttempts + 1;
      const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS;
      
      const updateData: any = {
        failedLoginAttempts: newAttempts
      };

      if (shouldLock) {
        const lockoutEnd = new Date();
        lockoutEnd.setMinutes(lockoutEnd.getMinutes() + LOCKOUT_DURATION_MINUTES);
        updateData.lockedUntil = lockoutEnd;
      }

      await prisma.user.update({
        where: { username },
        data: updateData
      });

      return shouldLock;
    } catch (error) {
      console.error('Error incrementing failed attempts:', error);
      return false;
    }
  }

  /**
   * Reset failed login attempts for a user (called on successful login)
   * @param username The username to reset attempts for
   * @returns Promise<void>
   */
  static async resetFailedAttempts(username: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { username },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      });
    } catch (error) {
      console.error('Error resetting failed attempts:', error);
      // Don't throw - this shouldn't prevent successful login
    }
  }

  /**
   * Get the lockout end time for a user
   * @param username The username to check
   * @returns Promise<Date | null> The lockout end time or null if not locked
   */
  static async getLockoutEndTime(username: string): Promise<Date | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { username },
        select: { lockedUntil: true }
      });

      return user?.lockedUntil || null;
    } catch (error) {
      console.error('Error getting lockout end time:', error);
      return null;
    }
  }
}