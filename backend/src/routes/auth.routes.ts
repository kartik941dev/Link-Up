import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { pool } from '../utils/db.js';
import { config } from '../config.js';
import { isValidEmail, isValidPassword } from '../utils/validators.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

const generateToken = (payload: { id: string; email: string }): string => {
  const options: SignOptions = {
    expiresIn: config.jwtExpiration as unknown as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, config.jwtSecret, options);
};

// 1. User Registration (Signup)
router.post('/signup', async (req, res, next): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !isValidEmail(email)) {
      res.status(400).json({
        error: 'A valid email address is required.',
        code: 'INVALID_EMAIL',
      });
      return;
    }

    const passwordCheck = isValidPassword(password);
    if (!passwordCheck.valid) {
      res.status(400).json({
        error: passwordCheck.error,
        code: 'INVALID_PASSWORD',
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      res.status(409).json({
        error: 'An account with this email address already exists.',
        code: 'EMAIL_ALREADY_EXISTS',
      });
      return;
    }

    // Hash password with bcrypt (salt factor 10)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    const insertResult = await pool.query(
      `INSERT INTO users (email, password_hash) 
       VALUES ($1, $2) 
       RETURNING id, email, created_at`,
      [normalizedEmail, passwordHash]
    );

    const newUser = insertResult.rows[0];
    const token = generateToken({ id: newUser.id, email: newUser.email });

    res.status(201).json({
      message: 'User registered successfully.',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        created_at: newUser.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 2. User Login (Signin)
router.post('/signin', async (req, res, next): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        error: 'Email and password are both required.',
        code: 'MISSING_CREDENTIALS',
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Fetch user
    const userResult = await pool.query(
      'SELECT id, email, password_hash, created_at FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (userResult.rows.length === 0) {
      res.status(401).json({
        error: 'Invalid email or password.',
        code: 'INVALID_CREDENTIALS',
      });
      return;
    }

    const user = userResult.rows[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({
        error: 'Invalid email or password.',
        code: 'INVALID_CREDENTIALS',
      });
      return;
    }

    const token = generateToken({ id: user.id, email: user.email });

    res.status(200).json({
      message: 'Logged in successfully.',
      token,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 3. Current User Profile (/me)
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response, next): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userResult = await pool.query(
      'SELECT id, email, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({
        error: 'User profile not found.',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    res.status(200).json({
      user: userResult.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

// 4. Logout route (Stateless client token invalidation)
router.post('/signout', (_req, res) => {
  res.status(200).json({
    message: 'Signed out successfully.',
  });
});

export default router;
