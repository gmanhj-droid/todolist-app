import { authService } from '../services/authService.js';

/**
 * HTTP controller layer for authentication endpoints.
 *
 * Express 5 automatically catches errors thrown inside async handlers and
 * forwards them to the global error-handling middleware, so try/catch blocks
 * are intentionally omitted here.
 */
export const authController = {
  /**
   * POST /api/auth/sign-up
   * Register a new user account.
   * Responds 201 with { success: true, data: { token, user } }
   */
  async signUp(req, res) {
    const { email, password } = req.body;
    const data = await authService.signUp({ email, password });
    res.status(201).json({ success: true, data });
  },

  /**
   * POST /api/auth/sign-in
   * Authenticate an existing user.
   * Responds 200 with { success: true, data: { token, user } }
   */
  async signIn(req, res) {
    const { email, password } = req.body;
    const data = await authService.signIn({ email, password });
    res.status(200).json({ success: true, data });
  },

  /**
   * POST /api/auth/sign-out
   * Sign-out is handled client-side (token disposal).
   * This endpoint simply acknowledges the request for API consistency.
   * Responds 200 with { success: true }
   */
  async signOut(_req, res) {
    res.status(200).json({ success: true });
  },

  /**
   * DELETE /api/auth/account
   * Permanently delete the authenticated user's account.
   * Responds 200 with { success: true }
   */
  async deleteAccount(req, res) {
    await authService.deleteAccount(req.user.userId);
    res.status(200).json({ success: true });
  },
};
