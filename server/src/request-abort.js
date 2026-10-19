/**
 * Wire each request's abortSignal to client disconnects.
 *
 * The chat routes pass `req.abortSignal` to the provider adapter so an
 * interrupted turn (Stop button, Esc, new message, closed tab) cancels the
 * in-flight upstream provider call — no orphaned generation, no wasted tokens.
 * The signal must fire only when the client actually goes away before the
 * response finished; normal completion never aborts.
 *
 * @returns {import('express').RequestHandler}
 */
export function wireClientAbort() {
  return (req, res, next) => {
    const controller = new AbortController();
    req.abortSignal = controller.signal;
    // A client hanging up mid-response surfaces as EPIPE/destroyed-stream
    // noise on the response object — swallow it; the route's abort logic
    // decides what "disconnected" means for the handler.
    res.on('error', () => {});
    res.on('close', () => {
      if (!res.writableEnded) {
        controller.abort(new DOMException('The client disconnected.', 'AbortError'));
      }
    });
    next();
  };
}
