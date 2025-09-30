import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import jwt from "jsonwebtoken";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
    interface Request {
      user?: SelectUser;
    }
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  // Handle demo admin password
  if (stored === "admin_hashed_password" && supplied === "Admin") {
    return true;
  }
  
  const parts = stored.split(".");
  if (parts.length !== 2) {
    return false;
  }
  
  const [hashed, salt] = parts;
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// JWT middleware for authentication - supports both JWT tokens and session-based auth
export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  console.log(`[AUTH] ${req.method} ${req.path} - Has auth header: ${!!authHeader}, Session auth: ${req.isAuthenticated?.()}`);
  
  // First, try JWT token authentication
  if (authHeader) {
    const token = authHeader.split(' ')[1]; // Bearer TOKEN
    
    jwt.verify(token, process.env.SESSION_SECRET!, async (err, user) => {
      if (err) {
        console.log('JWT verification failed:', err.message);
        return res.sendStatus(403);
      }
      
      req.user = user as SelectUser;
      console.log(`[AUTH] JWT verified for user: ${req.user.username}`);
      
      // Update last login time (don't block authentication on failure)
      if (req.user?.id) {
        try {
          await storage.updateUserLastLogin(req.user.id);
        } catch (error) {
          console.error('Failed to update last login time:', error);
          // Continue with authentication even if last login update fails
        }
      }
      
      next();
    });
  } else if (req.isAuthenticated && req.isAuthenticated()) {
    // Fall back to session-based authentication (Passport.js)
    console.log('[AUTH] Authenticated via session');
    next();
  } else {
    console.log('[AUTH] Authentication failed - no JWT and no session');
    res.sendStatus(401);
  }
}

// RBAC Middleware Functions

// Middleware to require specific role(s)
export function requireRole(...roleNames: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      await logAuditEvent(req, 'ACCESS_DENIED', 'AUTH', null, false, 'No authenticated user');
      return res.status(401).json({ message: 'Authentication required' });
    }

    try {
      // Get user roles
      const userRoles = await storage.getUserRoles(req.user.id);
      const roleIds = userRoles.map(ur => ur.roleId);
      
      // Get role objects
      const roles = await storage.getRoles();
      const userRoleNames = roles
        .filter(role => roleIds.includes(role.id))
        .map(role => role.name);

      // Check if user has any of the required roles
      const hasRequiredRole = roleNames.some(roleName => 
        userRoleNames.includes(roleName)
      );

      if (!hasRequiredRole) {
        await logAuditEvent(
          req, 
          'ACCESS_DENIED', 
          'ROLE_CHECK', 
          null, 
          false, 
          `Required roles: [${roleNames.join(', ')}], User roles: [${userRoleNames.join(', ')}]`
        );
        return res.status(403).json({ 
          message: 'Insufficient role permissions',
          required: roleNames,
          userRoles: userRoleNames
        });
      }

      // Log successful access
      await logAuditEvent(
        req, 
        'ACCESS_GRANTED', 
        'ROLE_CHECK', 
        null, 
        true, 
        `Required roles: [${roleNames.join(', ')}], User roles: [${userRoleNames.join(', ')}]`
      );

      next();
    } catch (error) {
      console.error('Role check error:', error);
      await logAuditEvent(req, 'ACCESS_ERROR', 'ROLE_CHECK', null, false, 'Role check failed');
      return res.status(500).json({ message: 'Role verification failed' });
    }
  };
}

// Middleware to require specific permission(s)
export function requirePermission(...permissionNames: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      await logAuditEvent(req, 'ACCESS_DENIED', 'AUTH', null, false, 'No authenticated user');
      return res.status(401).json({ message: 'Authentication required' });
    }

    try {
      // Get user permissions through roles
      const userPermissions = await storage.getUserPermissions(req.user.id);
      const userPermissionNames = userPermissions.map(p => p.name);

      // Check if user has all required permissions
      const hasAllPermissions = permissionNames.every(permName => 
        userPermissionNames.includes(permName)
      );

      if (!hasAllPermissions) {
        const missingPermissions = permissionNames.filter(permName => 
          !userPermissionNames.includes(permName)
        );
        
        await logAuditEvent(
          req, 
          'ACCESS_DENIED', 
          'PERMISSION_CHECK', 
          null, 
          false, 
          `Required permissions: [${permissionNames.join(', ')}], Missing: [${missingPermissions.join(', ')}]`
        );
        
        return res.status(403).json({ 
          message: 'Insufficient permissions',
          required: permissionNames,
          missing: missingPermissions
        });
      }

      // Log successful access
      await logAuditEvent(
        req, 
        'ACCESS_GRANTED', 
        'PERMISSION_CHECK', 
        null, 
        true, 
        `Required permissions: [${permissionNames.join(', ')}]`
      );

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      await logAuditEvent(req, 'ACCESS_ERROR', 'PERMISSION_CHECK', null, false, 'Permission check failed');
      return res.status(500).json({ message: 'Permission verification failed' });
    }
  };
}

// Helper function to log audit events
async function logAuditEvent(
  req: Request,
  action: string,
  resource: string,
  resourceId: string | null,
  success: boolean,
  errorMessage?: string
) {
  try {
    await storage.createAuditLog({
      userId: req.user?.id,
      action,
      resource,
      resourceId,
      ipAddress: req.ip || req.connection.remoteAddress || undefined,
      userAgent: req.get('User-Agent') || undefined,
      success,
      errorMessage: errorMessage,
      actorName: req.user?.username || undefined,
      metadata: JSON.stringify({
        url: req.originalUrl,
        method: req.method,
        params: req.params,
        query: req.query
      })
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

// Generate JWT token with permissions
async function generateToken(user: SelectUser): Promise<string> {
  // Get user permissions for the token
  const permissions = await storage.getUserPermissions(user.id);
  const permissionNames = permissions.map(p => p.name);
  
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username,
      createdAt: user.createdAt,
      permissions: permissionNames
    },
    process.env.SESSION_SECRET!,
    { expiresIn: '24h' }
  );
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    name: 'fishfire.sid', // Custom session name
    cookie: {
      secure: false, // Set to false for development
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    }
  };

  // Only trust proxy in production
  if (process.env.NODE_ENV === 'production') {
    app.set("trust proxy", 1);
    sessionSettings.cookie!.secure = true;
  }
  
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Add session debugging middleware after session is set up
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      console.log(`${req.method} ${req.path} - Session ID: ${req.sessionID || 'none'}`);
      console.log('Session data:', req.session);
      console.log('Is authenticated:', req.isAuthenticated());
    }
    next();
  });

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const user = await storage.getUserByUsername(username);
      if (!user || !(await comparePasswords(password, user.password))) {
        return done(null, false);
      } else {
        return done(null, user);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    console.log('Serializing user:', user.id);
    done(null, user.id);
  });
  passport.deserializeUser(async (id: string, done) => {
    console.log('Deserializing user ID:', id);
    const user = await storage.getUser(id);
    console.log('Found user:', user ? user.username : 'null');
    done(null, user);
  });

  // Self-registration disabled - users can only be created by admins through User Management
  app.post("/api/register", async (req, res, next) => {
    return res.status(403).json({ 
      message: "Self-registration is disabled. Please contact an administrator to create your account." 
    });
    
    /* Original registration code - now disabled
    const existingUser = await storage.getUserByUsername(req.body.username);
    if (existingUser) {
      return res.status(400).send("Username already exists");
    }

    const user = await storage.createUser({
      ...req.body,
      password: await hashPassword(req.body.password),
    });

    req.login(user, (err) => {
      if (err) return next(err);
      res.status(201).json(user);
    });
    */
  });

  app.post("/api/login", passport.authenticate("local"), async (req, res) => {
    const user = req.user as SelectUser;
    
    // Get user permissions
    const permissions = await storage.getUserPermissions(user.id);
    const permissionNames = permissions.map(p => p.name);
    
    // Get user roles
    const userRoles = await storage.getUserRoles(user.id);
    const roles = await storage.getRoles();
    const userRoleData = roles.filter(role => 
      userRoles.some(ur => ur.roleId === role.id)
    );
    
    // Generate token with permissions
    const token = await generateToken(user);
    
    res.status(200).json({
      user: user,
      token: token,
      permissions: permissionNames,
      roles: userRoleData.map(r => r.name)
    });
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", authenticateJWT, (req, res) => {
    res.json(req.user);
  });
}
