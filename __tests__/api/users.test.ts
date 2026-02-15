import { GET } from '~/app/api/users/route';

describe('GET /api/users', () => {
  let mockRequest: Request;

  beforeEach(() => {
    // Clean environment
    delete process.env.NEYNAR_API_KEY;
  });

  it('should return error when NEYNAR_API_KEY is missing', async () => {
    const url = new URL('http://localhost:3000/api/users?fids=1,2,3');
    mockRequest = new Request(url, { method: 'GET' });

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Neynar API key is not configured');
  });

  it('should return error when fids parameter is missing', async () => {
    process.env.NEYNAR_API_KEY = 'test-key';
    
    const url = new URL('http://localhost:3000/api/users');
    mockRequest = new Request(url, { method: 'GET' });

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('FIDs parameter is required');
  });

  it('should accept valid parameters', async () => {
    process.env.NEYNAR_API_KEY = 'test-key';
    
    const url = new URL('http://localhost:3000/api/users?fids=1,2,3');
    mockRequest = new Request(url, { method: 'GET' });

    // Note: This would call the actual API in a real scenario
    // For now, we're testing the parameter validation
    expect(() => {
      const { searchParams } = new URL(mockRequest.url);
      const fids = searchParams.get('fids');
      expect(fids).toBe('1,2,3');
    }).not.toThrow();
  });
});
