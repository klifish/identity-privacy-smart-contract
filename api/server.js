const express = require('express');
const path = require('path');
const identityRoutes = require('./routes/identity');
const simulationRoutes = require('./routes/simulation');
const operationsRoutes = require('./routes/operations');

const app = express();

app.use(express.json({ limit: '1mb' }));

const staticDir = path.join(__dirname, '..', 'web');
app.use(express.static(staticDir));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/identity', identityRoutes);
app.use('/api/simulation', simulationRoutes);
app.use('/api/operations', operationsRoutes);

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ error: message });
});

const PORT = process.env.PORT || process.env.API_PORT || 4000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API server listening on port ${PORT}`);
  });
}

module.exports = app;
