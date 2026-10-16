const jwt = require("jsonwebtoken");

function authenticateToken(request, response, next) {
  const authorization = request.headers.authorization;
  const [scheme, token] = authorization
    ? authorization.split(" ")
    : [];

  if (scheme !== "Bearer" || !token) {
    return response.status(401).json({ message: "Authentication required." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    request.user = {
      id: Number(payload.sub),
      role: payload.role,
    };

    next();
  } catch (error) {
    return response.status(401).json({ message: "Invalid or expired token." });
  }
}

function requireRole(...allowedRoles) {
  return (request, response, next) => {
    if (!request.user || !allowedRoles.includes(request.user.role)) {
      return response.status(403).json({ message: "Access denied." });
    }

    next();
  };
}

module.exports = { authenticateToken, requireRole };
