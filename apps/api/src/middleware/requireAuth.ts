import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// 	This is a TypeScript interface extension.
// 	The normal Express Request object doesn’t have a user property.
// 	Add a custom property (user) so TypeScript recognizes it later when you write req.user.
export interface AuthReq extends Request { user?: { id: number } }

export function requireAuth(req: AuthReq, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: number };
    req.user = { id: payload.id };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

//  requireAuth is server-side middleware that runs for protected API endpoints (like /projects). the flow:
// 	•	Vue page calls GET /projects with header Authorization: Bearer <token>
// 	•	Express receives the request → projectsRouter.use(requireAuth) runs first
// 	•	requireAuth verifies the token, sets req.user = { id }, calls next()
// 	•	the handler runs (findMany / create) using req.user!.id
// 	•	if token is missing/invalid → it returns 401 and doesn’t reach your handler

// important: requireAuth does not run when calling router.push();
// it only runs on HTTP requests to the backend.