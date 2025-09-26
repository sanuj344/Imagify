import jwt from 'jsonwebtoken';

export const userAuth = async (req, res, next) => {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1]; // Bearer <token>
    } else if (req.headers.token) {
      token = req.headers.token; // fallback for old requests
    }

    if (!token) {
      return res.status(401).json({ success: false, message: "Not Authorized. Login again" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || !decoded.id) {
      return res.status(401).json({ success: false, message: "Not Authorized. Login again" });
    }

    req.userId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: error.message });
  }
};
