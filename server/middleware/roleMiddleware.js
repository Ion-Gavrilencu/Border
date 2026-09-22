const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Nu ești autentificat.",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Nu ai permisiunea necesară.",
      });
    }

    next();
  };
};

module.exports = authorizeRoles;