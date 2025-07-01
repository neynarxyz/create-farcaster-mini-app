import { type ReactElement } from "react";
import { BaseError, UserRejectedRequestError } from "viem";

/**
 * Renders an error object in a user-friendly format.
 * 
 * This utility function takes an error object and renders it as a React element
 * with consistent styling. It handles different types of errors including:
 * - Error objects with message properties
 * - Objects with error properties
 * - String errors
 * - Unknown error types
 * - User rejection errors (special handling for wallet rejections)
 * 
 * The rendered error is displayed in a gray container with monospace font
 * for better readability of technical error details. User rejections are
 * displayed with a simpler, more user-friendly message.
 * 
 * @param error - The error object to render
 * @returns ReactElement - A styled error display component, or null if no error
 * 
 * @example
 * ```tsx
 * {isError && renderError(error)}
 * ```
 */
export function renderError(error: unknown): ReactElement | null {
  // Handle null/undefined errors
  if (!error) return null;
  
  // Special handling for user rejections in wallet operations
  if (error instanceof BaseError) {
    const isUserRejection = error.walk(
      (e) => e instanceof UserRejectedRequestError
    );

    if (isUserRejection) {
      return (
        <div className="mt-2 p-2 text-xs bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="font-semibold text-red-500 mb-1">User Rejection</div>
          <div>Transaction was rejected by user.</div>
        </div>
      );
    }
  }
  
  // Extract error message from different error types
  let errorMessage: string;
  
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'object' && error !== null && 'error' in error) {
    errorMessage = String(error.error);
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else {
    errorMessage = 'Unknown error occurred';
  }

  return (
    <div className="mt-2 p-2 text-xs overflow-x-scroll bg-gray-100 dark:bg-gray-800 rounded-lg font-mono">
      <div className="font-semibold text-red-500 mb-1">Error</div>
      <div className="whitespace-pre-wrap break-words">{errorMessage}</div>
    </div>
  );
} 