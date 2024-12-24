const { validate, ValidationError, schemas } = require('./validator');

describe('Validator', () => {
  describe('authorize schema', () => {
    it('should validate valid authorize request', () => {
      const validData = {
        client_id: 'test-client',
        scope: 'openid user:email',
        state: 'abcdef1234567890',
        response_type: 'code',
        nonce: 'test-nonce-123456',
      };

      expect(() => validate('authorize', validData)).not.toThrow();
    });

    it('should validate without optional nonce', () => {
      const validData = {
        client_id: 'test-client',
        scope: 'openid user:email',
        state: 'abcdef1234567890',
        response_type: 'code',
      };

      expect(() => validate('authorize', validData)).not.toThrow();
    });

    it('should throw on invalid client_id', () => {
      const invalidData = {
        client_id: 'test@client', // Contains invalid character
        scope: 'openid user:email',
        state: 'abcdef1234567890',
        response_type: 'code',
      };

      expect(() => validate('authorize', invalidData)).toThrow();
      expect(() => validate('authorize', invalidData)).toThrow(
        'Validation failed',
      );
    });

    it('should throw on invalid scope', () => {
      const invalidData = {
        client_id: 'test-client',
        scope: 'invalid-scope',
        state: 'abcdef1234567890',
        response_type: 'code',
      };

      expect(() => validate('authorize', invalidData)).toThrow(
        'Validation failed',
      );
    });

    it('should throw on invalid state length', () => {
      const invalidData = {
        client_id: 'test-client',
        scope: 'openid user:email',
        state: 'short',
        response_type: 'code',
      };

      expect(() => validate('authorize', invalidData)).toThrow(
        'Validation failed',
      );
    });

    it('should throw on invalid response_type', () => {
      const invalidData = {
        client_id: 'test-client',
        scope: 'openid user:email',
        state: 'abcdef1234567890',
        response_type: 'token', // Only 'code' is valid
      };

      expect(() => validate('authorize', invalidData)).toThrow(
        'Validation failed',
      );
    });
  });

  describe('token schema', () => {
    it('should validate valid token request', () => {
      const validData = {
        code: 'valid-code-123',
        client_id: 'test-client',
        state: 'abcdef1234567890',
        code_verifier:
          'test-verifier-123456789012345678901234567890123456789012',
      };

      expect(() => validate('token', validData)).not.toThrow();
    });

    it('should validate without optional parameters', () => {
      const validData = {
        code: 'valid-code-123',
        client_id: 'test-client',
      };

      expect(() => validate('token', validData)).not.toThrow();
    });

    it('should throw on invalid code format', () => {
      const invalidData = {
        code: 'invalid@code', // Contains invalid character
        state: 'abcdef1234567890',
      };

      expect(() => validate('token', invalidData)).toThrow('Validation failed');
    });

    it('should throw on invalid state length when provided', () => {
      const invalidData = {
        code: 'valid-code-123',
        state: 'short', // Too short
      };

      expect(() => validate('token', invalidData)).toThrow('Validation failed');
    });

    it('should throw on invalid code_verifier format when provided', () => {
      const invalidData = {
        code: 'valid-code-123',
        code_verifier: 'invalid@verifier', // Contains invalid character
      };

      expect(() => validate('token', invalidData)).toThrow('Validation failed');
    });
  });

  describe('ValidationError', () => {
    it('should create error with correct properties', () => {
      const field = 'test_field';
      const value = 'test_value';
      const message = 'test message';
      const error = new ValidationError(message, field, value);

      expect(error.name).toBe('ValidationError');
      expect(error.field).toBe(field);
      expect(error.value).toBe(value);
      expect(error.message).toBe(message);
    });
  });

  describe('validate function', () => {
    it('should throw on unknown schema', () => {
      expect(() => validate('unknown', {})).toThrow('Unknown schema: unknown');
    });

    it('should throw on missing required fields', () => {
      const invalidData = {
        // Missing required client_id
        scope: 'openid user:email',
        state: 'abcdef1234567890',
        response_type: 'code',
      };

      expect(() => validate('authorize', invalidData)).toThrow(
        'Validation failed',
      );
    });

    it('should handle null or undefined values', () => {
      const invalidData = {
        client_id: null,
        scope: undefined,
        state: 'abcdef1234567890',
        response_type: 'code',
      };

      expect(() => validate('authorize', invalidData)).toThrow(
        'Validation failed',
      );
    });
  });
});
