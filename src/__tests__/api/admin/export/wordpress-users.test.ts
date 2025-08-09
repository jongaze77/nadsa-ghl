// src/__tests__/api/admin/export/wordpress-users.test.ts

import { NextRequest } from 'next/server';
import { GET } from '../../../../app/api/admin/export/wordpress-users/route';

// Mock next-auth
jest.mock('next-auth/next');
const mockGetServerSession = require('next-auth/next').getServerSession;

// Mock export service
jest.mock('../../../../lib/export-service');
const mockExportService = require('../../../../lib/export-service');

describe('/api/admin/export/wordpress-users', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);
      
      const request = new NextRequest('http://localhost:3000/api/admin/export/wordpress-users');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });

    it('should return 403 when user is not admin', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: '1', role: 'user' }
      });
      
      const request = new NextRequest('http://localhost:3000/api/admin/export/wordpress-users');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Admin access required');
    });
  });

  describe('Preview functionality', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue({
        user: { id: '1', role: 'admin' }
      });
    });

    it('should return export preview when preview=true', async () => {
      const mockPreview = {
        count: 25,
        criteria: 'Membership Type = "Full" AND Renewal Date >= Today'
      };
      
      mockExportService.getExportPreview.mockResolvedValue(mockPreview);
      
      const request = new NextRequest('http://localhost:3000/api/admin/export/wordpress-users?preview=true');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockPreview);
      expect(mockExportService.getExportPreview).toHaveBeenCalled();
    });

    it('should handle preview errors gracefully', async () => {
      mockExportService.getExportPreview.mockRejectedValue(new Error('Database error'));
      
      const request = new NextRequest('http://localhost:3000/api/admin/export/wordpress-users?preview=true');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to generate export preview');
    });
  });

  describe('CSV Export functionality', () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue({
        user: { id: '1', role: 'admin' }
      });
    });

    it('should return CSV file when preview=false or not specified', async () => {
      const mockCsvData = 'user_login,user_email,role,first_name,last_name\nJohnDoe,john@example.com,"subscriber,Single Member",John,Doe';
      
      mockExportService.generateWordPressUsersCSV.mockResolvedValue(mockCsvData);
      
      const request = new NextRequest('http://localhost:3000/api/admin/export/wordpress-users');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
      expect(response.headers.get('content-disposition')).toContain('attachment; filename=');
      expect(response.headers.get('content-disposition')).toContain('wordpress-users-export-');
      expect(response.headers.get('content-disposition')).toContain('.csv');
      
      const responseText = await response.text();
      expect(responseText).toBe(mockCsvData);
    });

    it('should return 404 when no data available for export', async () => {
      const emptyCsvData = 'user_login,user_email,role,first_name,last_name';
      
      mockExportService.generateWordPressUsersCSV.mockResolvedValue(emptyCsvData);
      
      const request = new NextRequest('http://localhost:3000/api/admin/export/wordpress-users');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('No data available for export');
    });

    it('should handle CSV generation errors', async () => {
      mockExportService.generateWordPressUsersCSV.mockRejectedValue(new Error('Export failed'));
      
      const request = new NextRequest('http://localhost:3000/api/admin/export/wordpress-users');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to generate CSV export');
    });

    it('should set proper cache control headers for CSV download', async () => {
      const mockCsvData = 'user_login,user_email,role,first_name,last_name\nTestUser,test@example.com,subscriber,Test,User';
      
      mockExportService.generateWordPressUsersCSV.mockResolvedValue(mockCsvData);
      
      const request = new NextRequest('http://localhost:3000/api/admin/export/wordpress-users');
      const response = await GET(request);

      expect(response.headers.get('cache-control')).toBe('no-cache, no-store, must-revalidate');
      expect(response.headers.get('pragma')).toBe('no-cache');
      expect(response.headers.get('expires')).toBe('0');
    });

    it('should generate filename with current date', async () => {
      const mockCsvData = 'user_login,user_email,role,first_name,last_name\nTestUser,test@example.com,subscriber,Test,User';
      
      mockExportService.generateWordPressUsersCSV.mockResolvedValue(mockCsvData);
      
      const request = new NextRequest('http://localhost:3000/api/admin/export/wordpress-users');
      const response = await GET(request);

      const contentDisposition = response.headers.get('content-disposition');
      const today = new Date().toISOString().split('T')[0];
      
      expect(contentDisposition).toContain(`wordpress-users-export-${today}.csv`);
    });
  });

  describe('HTTP Methods', () => {
    it('should only allow GET method', async () => {
      // The route file exports POST, PUT, DELETE that return 405
      // We can test the actual function imports if needed
      const { POST, PUT, DELETE } = require('../../../../app/api/admin/export/wordpress-users/route');
      
      const postResponse = await POST();
      const putResponse = await PUT();
      const deleteResponse = await DELETE();
      
      expect(postResponse.status).toBe(405);
      expect(putResponse.status).toBe(405);
      expect(deleteResponse.status).toBe(405);
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      mockGetServerSession.mockRejectedValue(new Error('Session error'));
      
      const request = new NextRequest('http://localhost:3000/api/admin/export/wordpress-users');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});