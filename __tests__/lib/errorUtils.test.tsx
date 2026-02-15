import { renderError } from '~/lib/errorUtils';
import { UserRejectedRequestError } from 'viem';
import React from 'react';

describe('errorUtils', () => {
  describe('renderError', () => {
    it('should return null for null error', () => {
      const result = renderError(null);
      expect(result).toBeNull();
    });

    it('should return null for undefined error', () => {
      const result = renderError(undefined);
      expect(result).toBeNull();
    });

    it('should handle Error objects', () => {
      const error = new Error('Test error message');
      const result = renderError(error);
      
      expect(result).not.toBeNull();
      expect(React.isValidElement(result)).toBe(true);
    });

    it('should handle objects with error property', () => {
      const errorObj = { error: 'Something went wrong' };
      const result = renderError(errorObj);
      
      expect(result).not.toBeNull();
      expect(React.isValidElement(result)).toBe(true);
    });

    it('should handle string errors', () => {
      const result = renderError('String error');
      
      expect(result).not.toBeNull();
      expect(React.isValidElement(result)).toBe(true);
    });

    it('should handle UserRejectedRequestError', () => {
      const error = new UserRejectedRequestError(new Error('User rejected'));
      const result = renderError(error);
      
      expect(result).not.toBeNull();
      expect(React.isValidElement(result)).toBe(true);
    });

    it('should handle unknown error types', () => {
      const unknownError = { foo: 'bar' };
      const result = renderError(unknownError);
      
      expect(result).not.toBeNull();
    });
  });
});
