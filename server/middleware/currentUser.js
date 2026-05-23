const { findUserById } = require('../services/users');

async function loadCurrentUser(req, res, next) {
  res.locals.currentUser = null;
  req.currentUser = null;

  if (!req.session?.userId) {
    return next();
  }

  const userId = Number(req.session.userId);

  if (!Number.isInteger(userId) || userId <= 0) {
    req.session.destroy(() => {});
    return next();
  }

  try {
    const user = await findUserById(userId);
    res.locals.currentUser = user;
    req.currentUser = user;

    if (!user) {
      req.session.destroy(() => {});
    }

    next();
  } catch (error) {
    console.error('Не удалось загрузить пользователя сессии:', error);
    next();
  }
}

module.exports = loadCurrentUser;
