export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

// Thrown when a filter-mode bulk action matches more than MAX_BULK_ROWS. This
// is a safety valve, not a real limit at this assignment's scale — it exists so
// an unfiltered "select all" on a table that's grown far past 10x fails loudly
// with a clear message instead of holding a transaction open indefinitely.
export class BulkTooLargeError extends Error {
  constructor(public maxRows: number) {
    super(
      `This filter matches more than ${maxRows.toLocaleString()} submissions. ` +
        `Narrow the filter and try again.`,
    );
    this.name = 'BulkTooLargeError';
  }
}
