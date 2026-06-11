/** Guard for /api/admin/* routes — requires is_admin=true */
const requireAdmin = (req, res, next) => {
  if (!req.employee.is_admin) {
    return res.status(403).json({
      data: null,
      error: "Forbidden",
      message: "We couldn't find that. Try going back.",
    });
  }
  next();
};

export default requireAdmin;
