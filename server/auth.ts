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

async function hashPassword(password: string) {
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

// JWT middleware for authentication
export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (authHeader) {
    const token = authHeader.split(' ')[1]; // Bearer TOKEN
    
    jwt.verify(token, process.env.SESSION_SECRET!, (err, user) => {
      if (err) {
        console.log('JWT verification failed:', err.message);
        return res.sendStatus(403);
      }
      
      req.user = user as SelectUser;
      next();
    });
  } else {
    console.log('No authorization header found');
    res.sendStatus(401);
  }
}

// Generate JWT token
function generateToken(user: SelectUser): string {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username,
      createdAt: user.createdAt 
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

  app.post("/api/register", async (req, res, next) => {
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
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    const user = req.user as SelectUser;
    const token = generateToken(user);
    
    res.status(200).json({
      user: user,
      token: token
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
