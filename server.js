const app = require('./api/index');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Navuryx PC Connect Bridge running on http://localhost:${PORT}`);
});
