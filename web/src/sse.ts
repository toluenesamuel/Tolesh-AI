/**
 * Minimal SSE reader for the chat stream route.
 *
 * Framing: events are separated by blank lines; a block carries optional
 * `event:` and one or more `data:` lines (joined with \n per the SSE spec).
 * Data payloads are JSON when parseable, else the raw string.
 */

export type SseEvent = { name: string; data: unknown };

/**
 * Read an SSE response body and dispatch each complete event to `onEvent`.
 * Malformed lines are skipped (the stream stays alive); a trailing event
 * without a final blank line is still dispatched.
 */
export async function readSse(
  res: Response,
  onEvent: (name: string, data: unknown) => void
): Promise<void> {
  if (!res.body) {
    throw new Error('SSE response had no stream body.');
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let eventName = 'message';
  const dataLines: string[] = [];

  const dispatch = () => {
    if (dataLines.length === 0 && eventName === 'message') {
      return; // empty block — separator noise, nothing to deliver
    }
    const raw = dataLines.join('\n');
    let data: unknown = raw;
    try {
      data = JSON.parse(raw);
    } catch {
      /* keep the raw string */
    }
    onEvent(eventName, data);
    eventName = 'message';
    dataLines.length = 0;
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).replace(/\r$/, '');
      buf = buf.slice(nl + 1);
      if (line === '') {
        dispatch();
      } else if (line.startsWith('event:')) {
        eventName = line.slice(6).trim() || 'message';
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
      // comments (":...") and other fields (id:, retry:) are ignored
    }
  }
  if (buf.trim()) {
    // Trailing line without newline — complete the pending event if any.
    if (buf.startsWith('data:')) dataLines.push(buf.slice(5).replace(/\r$/, ''));
    dispatch();
  }
}
