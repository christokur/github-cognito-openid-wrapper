# Jest Mocking Pattern

This document describes the standard mocking pattern used in our tests.

## Pattern Structure

### 1. Require Shared Mocks

Always require shared mocks as constants at the top of the test file:

```javascript
const { mockAxios } = require('../sharedMocks');
const { mockValues } = require('../mocks');
```

### 2. Declare Intercept Variables

Declare variables for modules you want to intercept using `let`:

```javascript
let logger;
let faviconVerifier;
```

### 3. Setup in beforeEach

Reset modules and load fresh copies in `beforeEach`:

```javascript
beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    logger = require('../connectors/logger');
    faviconVerifier = require('./favicon-verifier');
});
```

### 4. Cleanup in afterEach

Clean up ONLY the modules that were intercepted in `afterEach`:

```javascript
afterEach(() => {
    jest.resetModules();
    delete require.cache[require.resolve('./favicon-verifier')];
    delete require.cache[require.resolve('../connectors/logger')];
});
```

## Key Rules

1. Only intercept modules that need to be mocked or spied on
2. Do NOT declare `let` variables for pre-required mocks (mockAxios, mockValues)
3. Clean up exactly what was intercepted - no more, no less
4. Always reset modules both before and after tests

## Example Test File

```javascript
const { mockAxios } = require('../sharedMocks');
const { mockValues } = require('../mocks');

let logger;
let faviconVerifier;

describe('My Test Suite', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        logger = require('../connectors/logger');
        faviconVerifier = require('./favicon-verifier');
    });

    afterEach(() => {
        jest.resetModules();
        delete require.cache[require.resolve('./favicon-verifier')];
        delete require.cache[require.resolve('../connectors/logger')];
    });

    it('should do something', () => {
        // Your test here
    });
});
```

## Benefits

1. Ensures clean module state for each test
2. Prevents test pollution
3. Makes mocking dependencies explicit
4. Provides consistent cleanup
5. Makes tests more reliable and predictable
