# mapError Callers

## Callers


src/connectors/controllers.js:45:      const { code, status, headers = {}, message, errors } = mapError(error);

src/connectors/controllers.js:90:      const { code, status, headers = {}, message, errors } = mapError(error);  
// Will trigger invalid_token on GitHub 401

src/connectors/controllers.js:154:      const { code, status, headers = {}, message, errors } = mapError(error);  
// Will trigger invalid_token on GitHub 401

src/connectors/controllers.js:193:      const { code, status, headers = {}, message, errors } = mapError(error);

src/connectors/controllers.js:231:      const { code, status, headers = {}, message, errors } = mapError(error);
