/**
 * HTTP request logger middleware.
 * Logs method, path, status code, and response duration on each request.
 */
export function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, path } = req;
    const { statusCode } = res;

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        method,
        path,
        statusCode,
        durationMs: duration,
      })
    );
  });

  next();
}
