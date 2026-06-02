/** Catch-all error handler — never expose raw messages to the client */
const errorHandler = (err, _req, res, _next) => {
  const status = err.status || 500;
  res.status(status).json({
    data: null,
    error: err.message || "Internal server error",
    message: "Something went wrong — try again.",
  });
};

export default errorHandler;
