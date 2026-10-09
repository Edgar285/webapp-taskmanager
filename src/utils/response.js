function sendResponse(res, statusCode, data) {
  return res.status(statusCode).json({
    statusCode,
    data
  });
}

module.exports = { sendResponse };
