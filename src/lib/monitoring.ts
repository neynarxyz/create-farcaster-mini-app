/**
 * Production Monitoring and Logging Setup
 * 
 * This module provides comprehensive logging and monitoring for the MiniApp
 * in production environments. It tracks:
 * - API request/response times
 * - SDK initialization metrics
 * - User interactions
 * - Error tracking
 * - Performance metrics
 */

// Types for monitoring data
export interface RequestMetric {
  endpoint: string;
  method: string;
  duration: number; // milliseconds
  status: number;
  timestamp: string;
  userAgent?: string;
  path?: string;
}

export interface SDKMetric {
  event: 'initialized' | 'ready' | 'error';
  duration?: number; // time to ready
  timestamp: string;
  error?: string;
}

export interface PerformanceMetric {
  metric: string;
  value: number;
  unit: string;
  timestamp: string;
}

/**
 * Logger class for production monitoring
 */
class MiniAppLogger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isProduction = process.env.NODE_ENV === 'production';
  private logEndpoint = process.env.NEXT_PUBLIC_LOG_ENDPOINT || '/api/logs';

  /**
   * Log API request metrics
   */
  logApiRequest(metric: RequestMetric): void {
    if (!this.isProduction) return;

    try {
      // Send to logging service
      fetch(this.logEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'api_request',
          data: metric,
        }),
      }).catch(err => {
        console.error('Failed to log API request:', err);
      });
    } catch (error) {
      console.error('Error logging API request:', error);
    }
  }

  /**
   * Log SDK initialization metrics
   */
  logSDKEvent(metric: SDKMetric): void {
    if (this.isDevelopment) {
      console.log('[SDK Event]', metric);
    }

    if (!this.isProduction) return;

    try {
      fetch(this.logEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sdk_event',
          data: metric,
        }),
      }).catch(err => {
        console.error('Failed to log SDK event:', err);
      });
    } catch (error) {
      console.error('Error logging SDK event:', error);
    }
  }

  /**
   * Log performance metrics
   */
  logPerformance(metric: PerformanceMetric): void {
    if (this.isDevelopment) {
      console.log('[Performance]', metric);
    }

    if (!this.isProduction) return;

    try {
      fetch(this.logEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'performance',
          data: metric,
        }),
      }).catch(err => {
        console.error('Failed to log performance:', err);
      });
    } catch (error) {
      console.error('Error logging performance metric:', error);
    }
  }

  /**
   * Log errors
   */
  logError(error: unknown, context?: Record<string, unknown>): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    if (this.isDevelopment) {
      console.error('[Error]', errorMessage, context);
    }

    if (!this.isProduction) return;

    try {
      fetch(this.logEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'error',
          data: {
            message: errorMessage,
            stack: errorStack,
            context,
            timestamp: new Date().toISOString(),
          },
        }),
      }).catch(err => {
        console.error('Failed to log error:', err);
      });
    } catch (error) {
      console.error('Error logging error:', error);
    }
  }

  /**
   * Log page navigation
   */
  logPageView(path: string, title?: string): void {
    if (this.isDevelopment) {
      console.log('[Page View]', { path, title });
    }

    if (!this.isProduction) return;

    try {
      fetch(this.logEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'page_view',
          data: {
            path,
            title,
            timestamp: new Date().toISOString(),
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          },
        }),
      }).catch(err => {
        console.error('Failed to log page view:', err);
      });
    } catch (error) {
      console.error('Error logging page view:', error);
    }
  }

  /**
   * Log user interactions
   */
  logUserInteraction(action: string, metadata?: Record<string, unknown>): void {
    if (this.isDevelopment) {
      console.log('[User Interaction]', action, metadata);
    }

    if (!this.isProduction) return;

    try {
      fetch(this.logEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'user_interaction',
          data: {
            action,
            metadata,
            timestamp: new Date().toISOString(),
          },
        }),
      }).catch(err => {
        console.error('Failed to log user interaction:', err);
      });
    } catch (error) {
      console.error('Error logging user interaction:', error);
    }
  }
}

// Export singleton instance
export const logger = new MiniAppLogger();

/**
 * Middleware for API request logging
 */
export function withApiLogging(handler: Function) {
  return async function wrappedHandler(request: Request) {
    const startTime = performance.now();
    
    try {
      const response = await handler(request);
      
      const duration = performance.now() - startTime;
      const url = new URL(request.url);
      
      logger.logApiRequest({
        endpoint: url.pathname,
        method: request.method,
        duration,
        status: response.status,
        timestamp: new Date().toISOString(),
        path: url.pathname,
      });

      return response;
    } catch (error) {
      const duration = performance.now() - startTime;
      const url = new URL(request.url);
      
      logger.logError(error, {
        endpoint: url.pathname,
        method: request.method,
        duration,
      });

      throw error;
    }
  };
}

/**
 * Hook for SDK initialization monitoring
 */
export function useSDKMonitoring() {
  if (typeof window === 'undefined') return;

  const startTime = performance.now();

  return {
    logReady: () => {
      const duration = performance.now() - startTime;
      logger.logSDKEvent({
        event: 'ready',
        duration,
        timestamp: new Date().toISOString(),
      });
    },
    logError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.logSDKEvent({
        event: 'error',
        timestamp: new Date().toISOString(),
        error: errorMessage,
      });
    },
  };
}

export default logger;
