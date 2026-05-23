require('dotenv').config();

const createApp = require('./app');
const { PORT } = require('./config/constants');

const app = createApp();

app.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});
