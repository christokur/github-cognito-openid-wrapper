const { mockAxios } = require('../../../sharedMocks');
const { mockValues } = require('../../../mocks');

let logger;
let validator;
let errors;
let errorHandler;

describe('Error Handler', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        jest.mock('../../logger', () => ({
            error: jest.fn(),
            info: jest.fn()
        }));

        logger = require('../../logger');
        validator = require('../../../utils/validator');
        errors = require('../../../errors');
        errorHandler = require('./error-handler');
    });

    afterEach(() => {
        jest.resetModules();
        delete require.cache[require.resolve('./error-handler')];
        delete require.cache[require.resolve('../../logger')];
        delete require.cache[require.resolve('../../../utils/validator')];
        delete require.cache[require.resolve('../../../errors')];
    });

    describe('handleError', () => {
        it('should handle ValidationError', (done) => {
            const validationError = new validator.ValidationError('test_field', 'is invalid');

            errorHandler.handleError(validationError, (_, response) => {
                expect(response).toEqual({
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-store'
                    },
                    body: JSON.stringify({
                        error: 'invalid_request',
                        error_description: 'is invalid test_field'
                    })
                });
                expect(logger.error).toHaveBeenCalledWith({
                    message: 'Error handling request',
                    error: validationError.message,
                    stack: validationError.stack,
                    response: expect.any(Object)
                });
                done();
            });
        });

        it('should handle OAuthError', (done) => {
            const oauthError = new errors.OAuthError(
                errors.errorTypes.INVALID_CLIENT,
                'Invalid client credentials'
            );

            errorHandler.handleError(oauthError, (_, response) => {
                expect(response).toEqual({
                    statusCode: 401,
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-store'
                    },
                    body: JSON.stringify({
                        error: 'invalid_client',
                        error_description: 'Invalid client credentials'
                    })
                });
                expect(logger.error).toHaveBeenCalledWith({
                    message: 'Error handling request',
                    error: oauthError.message,
                    stack: oauthError.stack,
                    response: expect.any(Object)
                });
                done();
            });
        });

        it('should handle unexpected errors', (done) => {
            const unexpectedError = new Error('Something went wrong');

            errorHandler.handleError(unexpectedError, (_, response) => {
                expect(response).toEqual({
                    statusCode: 500,
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-store'
                    },
                    body: JSON.stringify({
                        error: 'server_error',
                        error_description: 'An unexpected error occurred'
                    })
                });
                expect(logger.error).toHaveBeenNthCalledWith(1, 'Unexpected error:', unexpectedError);
                expect(logger.error).toHaveBeenNthCalledWith(2, {
                    message: 'OAuth error',
                    error: {
                        error: 'server_error',
                        error_description: 'An unexpected error occurred'
                    },
                    stack: expect.stringContaining('Error: An unexpected error occurred')
                });
                expect(logger.error).toHaveBeenNthCalledWith(3, {
                    message: 'Error handling request',
                    error: unexpectedError.message,
                    stack: unexpectedError.stack,
                    response: expect.any(Object)
                });
                done();
            });
        });

        it('should handle errors without a message', (done) => {
            const errorWithoutMessage = new Error();

            errorHandler.handleError(errorWithoutMessage, (_, response) => {
                expect(response).toEqual({
                    statusCode: 500,
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-store'
                    },
                    body: JSON.stringify({
                        error: 'server_error',
                        error_description: 'An unexpected error occurred'
                    })
                });
                expect(logger.error).toHaveBeenNthCalledWith(1, 'Unexpected error:', errorWithoutMessage);
                expect(logger.error).toHaveBeenNthCalledWith(2, {
                    message: 'OAuth error',
                    error: {
                        error: 'server_error',
                        error_description: 'An unexpected error occurred'
                    },
                    stack: expect.stringContaining('Error: An unexpected error occurred')
                });
                expect(logger.error).toHaveBeenNthCalledWith(3, {
                    message: 'Error handling request',
                    error: '',
                    stack: errorWithoutMessage.stack,
                    response: expect.any(Object)
                });
                done();
            });
        });
    });
});
