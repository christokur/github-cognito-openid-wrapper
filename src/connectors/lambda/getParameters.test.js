const { mockAxios } = require('../../sharedMocks');
const { mockValues } = require('../../mocks');

// Declare intercept variables
let logger;
let getParameters;

describe('getParameters', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    
    logger = require('../logger');
    getParameters = require('./index').getParameters;
  });

  afterEach(() => {
    jest.resetModules();
    delete require.cache[require.resolve('./index')];
    delete require.cache[require.resolve('../logger')];
  });

  it('should extract query parameters for GET request', () => {
    const event = {
      httpMethod: 'GET',
      queryStringParameters: {
        code: 'test_code',
        state: 'test_state'
      }
    };

    const params = getParameters(event);
    expect(params).toEqual({
      code: 'test_code',
      state: 'test_state'
    });
  });

  it('should extract body parameters for POST request', () => {
    const event = {
      httpMethod: 'POST',
      body: {
        code: 'test_code',
        state: 'test_state'
      }
    };

    const params = getParameters(event);
    expect(params).toEqual({
      code: 'test_code',
      state: 'test_state'
    });
  });

  it('should handle missing query parameters', () => {
    const event = {
      httpMethod: 'GET'
    };

    const params = getParameters(event);
    expect(params).toEqual({});
  });

  it('should handle missing body', () => {
    const event = {
      httpMethod: 'POST'
    };

    const params = getParameters(event);
    expect(params).toEqual({});
  });
});
