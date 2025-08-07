import { AuthService } from '@/lib/AuthService';

// Mock Prisma client
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

// Type cast the mocked prisma
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Mock console.error to prevent noise in test output
const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy.mockClear();
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  describe('isAccountLocked', () => {
    it('should return false for user without lockout', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        lockedUntil: null,
      });

      const result = await AuthService.isAccountLocked('testuser');
      expect(result).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await AuthService.isAccountLocked('nonexistent');
      expect(result).toBe(false);
    });

    it('should return true for currently locked account', async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        lockedUntil: futureDate,
      });

      const result = await AuthService.isAccountLocked('testuser');
      expect(result).toBe(true);
    });

    it('should return false and reset lockout for expired lockout', async () => {
      const pastDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        lockedUntil: pastDate,
      });
      (mockPrisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await AuthService.isAccountLocked('testuser');
      expect(result).toBe(false);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { username: 'testuser' },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    });

    it('should return false and log error on database error', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('DB Error'));

      const result = await AuthService.isAccountLocked('testuser');
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Error checking account lock status:', expect.any(Error));
    });
  });

  describe('incrementFailedAttempts', () => {
    it('should increment attempts without locking (below threshold)', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        failedLoginAttempts: 3,
      });
      (mockPrisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await AuthService.incrementFailedAttempts('testuser');
      expect(result).toBe(false);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { username: 'testuser' },
        data: {
          failedLoginAttempts: 4,
        },
      });
    });

    it('should increment attempts and lock account at threshold', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        failedLoginAttempts: 4, // 5th attempt will trigger lock (default threshold)
      });
      (mockPrisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await AuthService.incrementFailedAttempts('testuser');
      expect(result).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { username: 'testuser' },
        data: {
          failedLoginAttempts: 5,
          lockedUntil: expect.any(Date),
        },
      });

      // Check that lockout duration is approximately 15 minutes
      const updateCall = (mockPrisma.user.update as jest.Mock).mock.calls[0][0];
      const lockoutTime = updateCall.data.lockedUntil as Date;
      const expectedTime = new Date(Date.now() + 15 * 60 * 1000);
      const timeDiff = Math.abs(lockoutTime.getTime() - expectedTime.getTime());
      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });

    it('should return false for non-existent user without revealing info', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await AuthService.incrementFailedAttempts('nonexistent');
      expect(result).toBe(false);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should return false and log error on database error', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('DB Error'));

      const result = await AuthService.incrementFailedAttempts('testuser');
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Error incrementing failed attempts:', expect.any(Error));
    });
  });

  describe('resetFailedAttempts', () => {
    it('should reset attempts and unlock account', async () => {
      (mockPrisma.user.update as jest.Mock).mockResolvedValue({});

      await AuthService.resetFailedAttempts('testuser');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { username: 'testuser' },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    });

    it('should not throw error on database failure', async () => {
      (mockPrisma.user.update as jest.Mock).mockRejectedValue(new Error('DB Error'));

      // Should not throw
      await expect(AuthService.resetFailedAttempts('testuser')).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith('Error resetting failed attempts:', expect.any(Error));
    });
  });

  describe('getLockoutEndTime', () => {
    it('should return lockout end time for locked account', async () => {
      const lockoutTime = new Date(Date.now() + 10 * 60 * 1000);
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        lockedUntil: lockoutTime,
      });

      const result = await AuthService.getLockoutEndTime('testuser');
      expect(result).toEqual(lockoutTime);
    });

    it('should return null for non-locked account', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        lockedUntil: null,
      });

      const result = await AuthService.getLockoutEndTime('testuser');
      expect(result).toBeNull();
    });

    it('should return null for non-existent user', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await AuthService.getLockoutEndTime('nonexistent');
      expect(result).toBeNull();
    });

    it('should return null and log error on database error', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('DB Error'));

      const result = await AuthService.getLockoutEndTime('testuser');
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Error getting lockout end time:', expect.any(Error));
    });
  });

  describe('Configuration Edge Cases', () => {
    const originalMaxAttempts = process.env.MAX_FAILED_ATTEMPTS;
    const originalLockoutDuration = process.env.LOCKOUT_DURATION_MINUTES;

    afterAll(() => {
      // Restore original values
      if (originalMaxAttempts !== undefined) {
        process.env.MAX_FAILED_ATTEMPTS = originalMaxAttempts;
      } else {
        delete process.env.MAX_FAILED_ATTEMPTS;
      }
      if (originalLockoutDuration !== undefined) {
        process.env.LOCKOUT_DURATION_MINUTES = originalLockoutDuration;
      } else {
        delete process.env.LOCKOUT_DURATION_MINUTES;
      }
    });

    it('should use default configuration values', async () => {
      // Ensure default values are used (5 attempts, 15 minutes)
      delete process.env.MAX_FAILED_ATTEMPTS;
      delete process.env.LOCKOUT_DURATION_MINUTES;

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        failedLoginAttempts: 4, // 5th attempt will trigger lock with defaults
      });
      (mockPrisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await AuthService.incrementFailedAttempts('testuser');
      expect(result).toBe(true);

      // Check that lockout duration is approximately 15 minutes (default)
      const updateCall = (mockPrisma.user.update as jest.Mock).mock.calls[0][0];
      const lockoutTime = updateCall.data.lockedUntil as Date;
      const expectedTime = new Date(Date.now() + 15 * 60 * 1000);
      const timeDiff = Math.abs(lockoutTime.getTime() - expectedTime.getTime());
      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle exactly at threshold attempts correctly', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        failedLoginAttempts: 4, // Exactly at threshold - 1
      });
      (mockPrisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await AuthService.incrementFailedAttempts('testuser');
      expect(result).toBe(true); // Should lock on 5th attempt
    });

    it('should handle lockout time exactly at current time', async () => {
      const exactTime = new Date();
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        lockedUntil: exactTime,
      });
      (mockPrisma.user.update as jest.Mock).mockResolvedValue({});

      // Should be considered expired and reset
      const result = await AuthService.isAccountLocked('testuser');
      expect(result).toBe(false);
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });
  });
});