import jwt from "jsonwebtoken";

/** Verify JWT on protected routes and attach employee payload to req */
const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ data: null, error: "Unauthorized", message: "Please log in to continue." });
  }

  const token = header.split(" ")[1];
  try {
    req.employee = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res
      .status(401)
      .json({ data: null, error: "Unauthorized", message: "Please log in to continue." });
  }
};

export default auth;
