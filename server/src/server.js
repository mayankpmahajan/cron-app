// app.js or server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const timeout = require('connect-timeout');
const apiRoutes = require('./routes/api');

const app = express();

// Middleware
app.use(cors());
app.use(timeout('30s')); // Set timeout to 30 seconds
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Error handling middleware for timeouts
app.use((req, res, next) => {
 if (!req.timedout) next();
});

// Request abort handling
app.use((err, req, res, next) => {
 if (err.type === 'request.aborted') {
   console.log('Request aborted by the client');
   return;
 }
 next(err);
});

// Routes
app.use('/api', apiRoutes);

// Global error handler
app.use((err, req, res, next) => {
 console.error('Global error:', err);
 res.status(500).json({ 
   error: 'Internal server error', 
   details: err.message 
 });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
 console.log(`Server running on port ${PORT}`);
 console.log(`API endpoint: http://localhost:${PORT}/api`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
 console.error('Uncaught Exception:', err);
 process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
 console.error('Unhandled Rejection at:', promise, 'reason:', reason);
 process.exit(1);
});