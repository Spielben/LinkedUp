import { timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function basicAuth(req: Request, res: Response, next: NextFunction): void {
  // Internal scheduler uses its own x-internal-token — bypass basic auth
  if ((req.path || "").startsWith("/api/internal")) {
    next();
    return;
  }

  const ownerUser = process.env.AUTH_OWNER_USER || "ben";
  const ownerPass = process.env.AUTH_OWNER_PASS;
  const collabUser = process.env.AUTH_COLLAB_USER;
  const collabPass = process.env.AUTH_COLLAB_PASS;

  // Auth not configured → open access (dev / first boot)
  if (!ownerPass) {
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="LINKDUP"');
    res.status(401).send("Authentication required");
    return;
  }

  let user: string;
  let pass: string;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const colon = decoded.indexOf(":");
    if (colon === -1) throw new Error();
    user = decoded.slice(0, colon);
    pass = decoded.slice(colon + 1);
  } catch {
    res.setHeader("WWW-Authenticate", 'Basic realm="LINKDUP"');
    res.status(401).send("Invalid credentials");
    return;
  }

  const isOwner = safeCompare(user, ownerUser) && safeCompare(pass, ownerPass);
  const isCollab =
    Boolean(collabUser && collabPass) &&
    safeCompare(user, collabUser!) &&
    safeCompare(pass, collabPass!);

  if (isOwner || isCollab) {
    next();
    return;
  }

  res.setHeader("WWW-Authenticate", 'Basic realm="LINKDUP"');
  res.status(401).send("Invalid credentials");
}
