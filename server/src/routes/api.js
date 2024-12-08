// routes/api.js
const express = require('express');
const router = express.Router();
const pool = require('../db/config');

router.post('/sync', async (req, res) => {
  let client;
  
  try {
    const { clientId, timestamp, data } = req.body;
    
    if (!clientId || !timestamp || !data) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    // Get last successful sync data
    const lastSyncResult = await client.query(
      `SELECT last_sync_data FROM sync_logs 
       WHERE client_id = $1 AND status = 'success' 
       ORDER BY timestamp DESC LIMIT 1`,
      [clientId]
    );

    const currentDataString = JSON.stringify(data);
    
    // Check if data has changed
    if (lastSyncResult.rows.length > 0) {
      const lastSyncData = lastSyncResult.rows[0].last_sync_data;
      if (lastSyncData === currentDataString) {
        console.log('No new data to sync');
        await client.query('COMMIT');
        return res.json({ success: true, message: 'No new data to sync' });
      }
    }

    console.log('New data detected, processing sync...');

    // Insert sync log for new data
    await client.query(
      `INSERT INTO sync_logs (client_id, timestamp, status, last_sync_data) 
       VALUES ($1, $2, $3, $4)`,
      [clientId, timestamp, 'processing', currentDataString]
    );

    const { users, tasks } = data;
    
    // Process users
    if (users && users.length > 0) {
      for (const user of users) {
        await client.query(
          'INSERT INTO users (name, email, age, client_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
          [user.name, user.email, user.age, clientId]
        );
      }
    }

    // Process tasks
    if (tasks && tasks.length > 0) {
      for (const task of tasks) {
        await client.query(
          'INSERT INTO tasks (title, description, user_id, completed, client_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
          [task.title, task.description, task.userId, task.completed, clientId]
        );
      }
    }

    // Update sync status
    await client.query(
      `UPDATE sync_logs 
       SET status = $1 
       WHERE client_id = $2 AND timestamp = $3`,
      ['success', clientId, timestamp]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Sync completed with new data' });

  } catch (error) {
    console.error('Sync error:', error);

    if (client) {
      await client.query('ROLLBACK').catch(console.error);
      
      try {
        await client.query(
          `UPDATE sync_logs 
           SET status = $1, error_message = $2 
           WHERE client_id = $3 AND timestamp = $4`,
          ['failed', error.message, req.body?.clientId, req.body?.timestamp]
        );
      } catch (logError) {
        console.error('Error logging failure:', logError);
      }
    }

    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  } finally {
    if (client) {
      client.release();
    }
  }
});

router.get('/sync-logs', async (req, res) => {
  let client;
  
  try {
    client = await pool.connect();
    
    const result = await client.query(
      `SELECT 
        client_id,
        timestamp,
        status,
        error_message,
        (SELECT COUNT(*) FROM users WHERE users.client_id = sync_logs.client_id) as total_users,
        (SELECT COUNT(*) FROM tasks WHERE tasks.client_id = sync_logs.client_id) as total_tasks
       FROM sync_logs
       WHERE timestamp IN (
         SELECT MAX(timestamp)
         FROM sync_logs
         GROUP BY client_id
       )
       ORDER BY timestamp DESC`
    );

    res.json({ 
      success: true, 
      logs: result.rows 
    });

  } catch (error) {
    console.error('Error fetching sync logs:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;