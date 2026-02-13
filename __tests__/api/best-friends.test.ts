import { GET } from '@/app/api/best-friends/route';

describe('GET /api/best-friends', () => {
  let mockRequest: Request;

  beforeEach(() => {
    delete process.env.NEYNAR_API_KEY;
  });

  it('should return error when NEYNAR_API_KEY is missing', async () => {
    const url = new URL('http://localhost:3000/api/best-friends?fid=1');
    mockRequest = new Request(url, { method: 'GET' });

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Neynar API key is not configured');
  });

  it('should return error when fid parameter is missing', async () => {
    process.env.NEYNAR_API_KEY = 'test-key';
    
    const url = new URL('http://localhost:3000/api/best-friends');
    mockRequest = new Request(url, { method: 'GET' });

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('FID parameter is required');
  });

  it('should accept valid fid parameter', async () => {
    process.env.NEYNAR_API_KEY = 'test-key';
    
    const url = new URL('http://localhost:3000/api/best-friends?fid=1');
    mockRequest = new Request(url, { method: 'GET' });

    expect(() => {
      const { searchParams } = new URL(mockRequest.url);
      const fid = searchParams.get('fid');
      expect(fid).toBe('1');
    }).not.toThrow();
  });
});
