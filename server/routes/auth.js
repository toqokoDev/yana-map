const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { getSafeReturnTo } = require('../middleware/auth');

const router = express.Router();

router.get('/register', async (req, res, next) => {
  try {
    await res.render('register', {
      pageTitle: 'Регистрация',
      error: null,
      formData: {},
      currentUser: res.locals.currentUser || null,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/register', async (req, res, next) => {
  const { fullName, email, password, passwordConfirm } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  try {
    if (!fullName || !normalizedEmail || !password || !passwordConfirm) {
      return res.status(400).render('register', {
        pageTitle: 'Регистрация',
        error: 'Заполните все поля.',
        formData: { fullName, email: normalizedEmail },
      });
    }

    if (password.length < 6) {
      return res.status(400).render('register', {
        pageTitle: 'Регистрация',
        error: 'Пароль должен быть не короче 6 символов.',
        formData: { fullName, email: normalizedEmail },
      });
    }

    if (password !== passwordConfirm) {
      return res.status(400).render('register', {
        pageTitle: 'Регистрация',
        error: 'Пароли не совпадают.',
        formData: { fullName, email: normalizedEmail },
      });
    }

    const [existingUsers] = await db.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [
      normalizedEmail,
    ]);

    if (existingUsers.length > 0) {
      return res.status(409).render('register', {
        pageTitle: 'Регистрация',
        error: 'Пользователь с таким email уже зарегистрирован.',
        formData: { fullName, email: normalizedEmail },
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await db.execute(
      'INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)',
      [fullName.trim(), normalizedEmail, passwordHash],
    );

    req.session.userId = result.insertId;
    res.redirect('/profile');
  } catch (error) {
    next(error);
  }
});

router.get('/login', async (req, res, next) => {
  try {
    const allowGuestView = req.query.reauth === '1';

    if (!allowGuestView && req.session?.isAdmin) {
      return res.redirect('/admin');
    }

    if (!allowGuestView && req.currentUser) {
      return res.redirect('/profile');
    }

    const returnTo = getSafeReturnTo(req.query.returnTo);

    await res.render('login', {
      pageTitle: 'Вход',
      error: null,
      email: '',
      returnTo,
      currentUser: null,
      info: returnTo === '/profile' ? 'Войдите, чтобы открыть личный кабинет.' : null,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  const loginValue = String(req.body.email || '').trim();
  const normalizedEmail = loginValue.toLowerCase();
  const password = String(req.body.password || '');
  const adminLogin = process.env.ADMIN_LOGIN || '';
  const adminPassword = process.env.ADMIN_PASSWORD || '';

  try {
    if (adminLogin && adminPassword && loginValue === adminLogin && password === adminPassword) {
      req.session.isAdmin = true;
      req.session.userId = null;
      return res.redirect('/admin');
    }

    const [rows] = await db.execute(
      'SELECT id, email, password_hash FROM users WHERE email = ? LIMIT 1',
      [normalizedEmail],
    );
    const user = rows[0];
    const isPasswordValid = user ? await bcrypt.compare(password, user.password_hash) : false;

    const returnTo = getSafeReturnTo(req.body.returnTo);

    if (!user || !isPasswordValid) {
      return res.status(401).render('login', {
        pageTitle: 'Вход',
        error: 'Неверный email или пароль.',
        email: normalizedEmail,
        returnTo,
        info: null,
      });
    }

    req.session.isAdmin = false;
    req.session.userId = user.id;
    res.redirect(returnTo);
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('karta.sid');
    res.redirect('/login');
  });
});

module.exports = router;
