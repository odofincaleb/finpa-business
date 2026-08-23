import { Request, Response, NextFunction } from "express";
import { getSupabase, hasSupabase } from "../lib/supabase";
import { AppError } from "../lib/errors";
import type { Profile } from "../types/transaction";
import { getProfile } from "../services/database";

export interface AuthedRequest extends Request {
  userId: string;
  userEmail: string;
  profile: Profile;
  accessToken: string;
}

function isActive(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > Date.now();
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError(401, "UNAUTHORIZED", "Missing bearer token");
    }
    const token = header.slice(7);

    let userId: string;
    let email: string;
    let profile: Profile;

    if (hasSupabase()) {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) {
        throw new AppError(401, "UNAUTHORIZED", "Invalid or expired session");
      }
      userId = data.user.id;
      email = data.user.email ?? "";
      profile = await getProfile(userId, email);
    } else {
      // Dev memory mode: token format "dev:<userId>:<email>"
      if (!token.startsWith("dev:")) {
        throw new AppError(
          401,
          "UNAUTHORIZED",
          "Supabase not configured. Use Authorization: Bearer dev:<userId>:<email>",
        );
      }
      const parts = token.split(":");
      userId = parts[1] || "dev-user";
      email = parts[2] || "dev@finpa.app";
      profile = await getProfile(userId, email);
    }

    const authed = req as AuthedRequest;
    authed.userId = userId;
    authed.userEmail = email;
    authed.profile = profile;
    authed.accessToken = token;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireSubscription(req: Request, _res: Response, next: NextFunction) {
  try {
    const { profile, userEmail } = req as AuthedRequest;
    // Superadmins bypass PIN gate (same as mobile Activate screen)
    if (isSuperAdminEmail(userEmail || profile.email)) {
      next();
      return;
    }
    if (!isActive(profile.subscription_expires_at)) {
      throw new AppError(
        403,
        "SUBSCRIPTION_REQUIRED",
        "Activate FINPA Business with a valid PIN to continue",
      );
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    const secret = req.headers["x-admin-secret"];
    if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
      throw new AppError(403, "FORBIDDEN", "Invalid admin secret");
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function parseSuperAdminEmails(): string[] {
  return (process.env.SUPERADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = parseSuperAdminEmails();
  if (!list.length) return false;
  return list.includes(email.trim().toLowerCase());
}

/** JWT superadmin OR x-admin-secret (for scripts). */
export async function requireSuperAdminOrSecret(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const secret = req.headers["x-admin-secret"];
  if (process.env.ADMIN_SECRET && secret === process.env.ADMIN_SECRET) {
    next();
    return;
  }

  await requireAuth(req, res, (err?: unknown) => {
    if (err) {
      next(err);
      return;
    }
    try {
      const { userEmail, profile } = req as AuthedRequest;
      const email = userEmail || profile.email;
      if (!isSuperAdminEmail(email)) {
        throw new AppError(403, "FORBIDDEN", "Super admin access required");
      }
      next();
    } catch (e) {
      next(e);
    }
  });
}
