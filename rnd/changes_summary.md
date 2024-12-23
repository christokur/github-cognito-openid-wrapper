
### Explanation of Changes Made:

1. **Fixed the `wait` Function:**
   - Replaced busy wait with `setTimeout`
   - Added a callback parameter to make it non-blocking
   - Maintains compatibility with Node.js callback pattern

2. **Updated `withRetry` Function:**
   - Now returns a function that takes a callback
   - Handles both synchronous and asynchronous operations without introducing Promises
   - Uses Node.js error-first callback pattern
   - Maintains proper error handling and logging
   - Keeps exponential backoff with jitter
