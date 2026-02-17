import { NextRequest, NextResponse } from 'next/server';

/**
 * API route for collecting logs from the client
 * 
 * This endpoint collects:
 * - API request metrics
 * - SDK initialization events
 * - Error logs
 * - Performance metrics
 * - User interactions
 * - Page views
 * 
 * In production, logs would be sent to services like:
 * - Datadog
 * - New Relic
 * - LogRocket
 * - Custom analytics service
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;

    // Validate log type
    const validTypes = ['api_request', 'sdk_event', 'performance', 'error', 'page_view', 'user_interaction'];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid log type', validTypes },
        { status: 400 }
      );
    }

    // Log the data (in production, send to logging service)
    console.log(`[${type.toUpperCase()}]`, {
      timestamp: new Date().toISOString(),
      data,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || 'unknown',
    });

    // Example: Send to external logging service
    if (process.env.LOG_SERVICE_URL) {
      try {
        await fetch(process.env.LOG_SERVICE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            data,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            version: process.env.app_version || 'unknown',
          }),
        });
      } catch (error) {
        console.error('Failed to send logs to external service:', error);
        // Don't fail the request, just log the error
      }
    }

    // Metrics for monitoring
    if (type === 'api_request') {
      const { duration, status } = data;
      if (duration > 5000) {
        console.warn('Slow API request detected:', data);
      }
      if (status >= 500) {
        console.warn('API error detected:', data);
      }
    }

    if (type === 'error') {
      console.warn('Client error logged:', data.message);
    }

    if (type === 'sdk_event' && data.event === 'error') {
      console.error('SDK error detected:', data.error);
    }

    return NextResponse.json({
      success: true,
      message: 'Log received',
      type,
    });
  } catch (error) {
    console.error('Error processing log:', error);
    return NextResponse.json(
      { error: 'Failed to process log' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to retrieve logs (optional, for development/debugging)
 * 
 * In production, remove this or add authentication
 */
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    message: 'Log collecting endpoint for Farcaster MiniApp',
    description: 'POST JSON with type and data to log events',
    validTypes: ['api_request', 'sdk_event', 'performance', 'error', 'page_view', 'user_interaction'],
    example: {
      type: 'api_request',
      data: {
        endpoint: '/api/users',
        method: 'GET',
        duration: 245,
        status: 200,
        timestamp: '2026-02-13T10:30:00Z',
      },
    },
  });
}
