const logger = require('../connectors/logger');

// Validation schemas
const schemas = {
  authorize: {
    client_id: {
      required: true,
      type: 'string',
      pattern: /^[a-zA-Z0-9-_]+$/,
      maxLength: 100,
    },
    scope: {
      required: true,
      type: 'string',
      validate: (value) => {
        const validScopes = ['openid', 'user', 'user:email', 'read:user'];
        const scopes = value.split(' ');
        return scopes.every((scope) => validScopes.includes(scope));
      },
    },
    state: {
      required: true,
      type: 'string',
      minLength: 16,
      maxLength: 2048,
      pattern: /^[A-Za-z0-9+/=._-]+$/,
    },
    response_type: {
      required: true,
      type: 'string',
      enum: ['code'],
    },
    nonce: {
      required: false,
      type: 'string',
      minLength: 16,
      maxLength: 100,
      pattern: /^[a-zA-Z0-9-_]+$/,
    },
  },
  token: {
    code: {
      required: true,
      type: 'string',
      pattern: /^[a-zA-Z0-9-_]+$/,
      maxLength: 256,
    },
    client_id: {
      required: true,
      type: 'string',
      pattern: /^[a-zA-Z0-9-_]+$/,
      maxLength: 100,
    },
    state: {
      required: false,
      type: 'string',
      minLength: 16,
      maxLength: 2048,
      pattern: /^[A-Za-z0-9+/=._-]+$/,
    },
    code_verifier: {
      required: false,
      type: 'string',
      minLength: 43,
      maxLength: 128,
      pattern: /^[A-Za-z0-9-._~]+$/,
    },
  },
  userinfo: {
    access_token: {
      required: true,
      type: 'string',
      pattern: /^[a-zA-Z0-9-_]+$/,
      maxLength: 256,
    },
  },
};

// Sanitization functions
const sanitizers = {
  string: (value) => {
    if (typeof value !== 'string') return value;
    // Remove control characters and zero-width spaces
    return value.replace(/[\x00-\x1F\x7F-\x9F\u200B-\u200D\uFEFF]/g, '');
  },
  scope: (value) => {
    if (typeof value !== 'string') return value;
    // Ensure scopes are space-separated and unique
    const scopes = new Set(value.split(/\s+/).filter(Boolean));
    return Array.from(scopes).join(' ');
  },
};

class ValidationError extends Error {
  constructor(message, field, value) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
    this.statusCode = 400;
  }
}

function validateField(field, value, rules) {
  // Required check
  if (
    rules.required &&
    (value === undefined || value === null || value === '')
  ) {
    throw new ValidationError(`${field} is required`, field, value);
  }

  // Skip further validation if value is not provided and not required
  if (value === undefined || value === null) {
    return;
  }

  // Type check
  if (rules.type && typeof value !== rules.type) {
    throw new ValidationError(
      `${field} must be of type ${rules.type}`,
      field,
      value,
    );
  }

  // String-specific validations
  if (rules.type === 'string' && typeof value === 'string') {
    if (rules.minLength && value.length < rules.minLength) {
      throw new ValidationError(
        `${field} must be at least ${rules.minLength} characters`,
        field,
        value,
      );
    }
    if (rules.maxLength && value.length > rules.maxLength) {
      throw new ValidationError(
        `${field} must not exceed ${rules.maxLength} characters`,
        field,
        value,
      );
    }
    if (rules.pattern && !rules.pattern.test(value)) {
      throw new ValidationError(
        `${field} contains invalid characters`,
        field,
        value,
      );
    }
  }

  // Enum check
  if (rules.enum && !rules.enum.includes(value)) {
    throw new ValidationError(
      `${field} must be one of: ${rules.enum.join(', ')}`,
      field,
      value,
    );
  }

  // Custom validation
  if (rules.validate && !rules.validate(value)) {
    throw new ValidationError(
      `${field} failed custom validation`,
      field,
      value,
    );
  }
}

function sanitizeValue(value, type = 'string') {
  const sanitizer = sanitizers[type] || sanitizers.string;
  return sanitizer(value);
}

function validate(schemaName, data) {
  const schema = schemas[schemaName];
  if (!schema) {
    throw new Error(`Unknown schema: ${schemaName}`);
  }

  const sanitized = {};
  const errors = [];

  // Validate and sanitize each field
  Object.entries(schema).forEach(([field, rules]) => {
    try {
      const value = data[field];
      validateField(field, value, rules);
      sanitized[field] = sanitizeValue(value, rules.type);
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push(error);
        logger.warn({
          message: 'Validation error',
          field: error.field,
          value: error.value,
          error: error.message,
        });
      } else {
        throw error;
      }
    }
  });

  // If there are any validation errors, throw with all errors
  if (errors.length > 0) {
    const error = new Error('Validation failed');
    error.name = 'ValidationError';
    error.statusCode = 400;
    error.code = 'invalid_request';
    error.errors = errors;
    errors.forEach((err) => {
      err.statusCode = 400;
    });
    throw error;
  }

  logger.debug({
    message: 'Validation successful',
    schemaName,
    sanitized,
  });

  return sanitized;
}

module.exports = {
  validate,
  ValidationError,
  schemas,
};
