function getSafeReturnTo(value, fallback = '/profile') {
  const raw = Array.isArray(value) ? value[0] : value;
  const returnTo = String(raw || '').trim();

  if (!/^\/[A-Za-z0-9/_-]*$/.test(returnTo)) {
    return fallback;
  }

  return returnTo;
}

function requireAuth(req, res, next) {
  if (req.session.isAdmin) {
    return res.redirect('/admin');
  }

  if (!req.currentUser) {
    const returnTo = encodeURIComponent(getSafeReturnTo(req.originalUrl));
    return res.redirect(`/login?returnTo=${returnTo}`);
  }

  next();
}

const { sendError } = require('../lib/apiResponse');

function requireApiAuth(req, res, next) {
  if (!req.currentUser) {
    return sendError(res, 401, 'Для выполнения действия нужно войти в личный кабинет.');
  }

  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) {
    return res.redirect('/admin/login');
  }

  next();
}

module.exports = { requireAuth, requireApiAuth, requireAdmin, getSafeReturnTo };
