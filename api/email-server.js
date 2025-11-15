import express from 'express';
import cors from 'cors';
import { Resend } from 'resend';
import { MongoClient } from 'mongodb';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Initialize Resend (will be set via environment variables in Vercel)
const resend = new Resend(process.env.RESEND_API_KEY);

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'hirezen';
let mongoClient;

async function connectMongoDB() {
  try {
    if (mongoClient) return mongoClient.db(DB_NAME);

    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    console.log('✅ MongoDB connected successfully!');
    return mongoClient.db(DB_NAME);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    return null;
  }
}

// Interview results endpoints
app.post('/interview-results', async (req, res) => {
  try {
    const db = await connectMongoDB();
    if (!db) {
      return res.status(500).json({ success: false, error: 'Database connection failed' });
    }

    const collection = db.collection('interview_results');
    const interviewData = {
      ...req.body,
      created_at: new Date(),
      id: Date.now().toString(),
      interview_type: 'video_interview',
      status: 'completed'
    };

    const result = await collection.insertOne(interviewData);
    console.log('✅ Interview results saved to MongoDB:', result.insertedId);

    res.json({
      success: true,
      id: result.insertedId,
      data: interviewData
    });

  } catch (error) {
    console.error('❌ Error saving interview results:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/interview-results', async (req, res) => {
  try {
    const db = await connectMongoDB();
    if (!db) {
      return res.status(500).json({ success: false, error: 'Database connection failed' });
    }

    const collection = db.collection('interview_results');

    // Build filter
    const filter = {};
    if (req.query.candidate_id) filter.candidate_id = req.query.candidate_id;
    if (req.query.candidate_email) filter.candidate_email = { $regex: req.query.candidate_email, $options: 'i' };
    if (req.query.job_id) filter.job_id = req.query.job_id;
    if (req.query.status) filter.status = req.query.status;

    const interviews = await collection
      .find(filter)
      .sort({ created_at: -1 })
      .limit(100)
      .toArray();

    res.json({
      success: true,
      data: interviews,
      count: interviews.length
    });

  } catch (error) {
    console.error('❌ Error fetching interview results:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/interview-results/:id', async (req, res) => {
  try {
    const db = await connectMongoDB();
    if (!db) {
      return res.status(500).json({ success: false, error: 'Database connection failed' });
    }

    const collection = db.collection('interview_results');
    const interview = await collection.findOne({
      $or: [
        { id: req.params.id },
        { _id: req.params.id }
      ]
    });

    if (!interview) {
      return res.status(404).json({ success: false, error: 'Interview result not found' });
    }

    res.json({
      success: true,
      data: interview
    });

  } catch (error) {
    console.error('❌ Error fetching interview result:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Activity logs endpoints
app.get('/activity-logs', async (req, res) => {
  try {
    const db = await connectMongoDB();
    if (!db) {
      return res.status(500).json({ success: false, error: 'Database connection failed' });
    }

    const collection = db.collection('activity_logs');

    // Parse query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (req.query.candidate_email) {
      filter.candidate_email = { $regex: req.query.candidate_email, $options: 'i' };
    }
    if (req.query.candidate_name) {
      filter.candidate_name = { $regex: req.query.candidate_name, $options: 'i' };
    }
    if (req.query.job_position) {
      filter.job_position = { $regex: req.query.job_position, $options: 'i' };
    }

    const total = await collection.countDocuments(filter);

    // Get the logs first, then add computed fields
    const logs = await collection
      .find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .project({
        video_data: 0, // Exclude binary video data from response
        _id: 0 // Exclude MongoDB _id
      })
      .toArray();

    // Add computed fields for video metadata
    logs.forEach(log => {
      log.has_video = log.video_mime_type && log.video_mime_type.length > 0;
      log.video_size = log.has_video ? (log.video_data_size || 0) : 0;
    });

    res.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/activity-logs', async (req, res) => {
  try {
    const db = await connectMongoDB();
    if (!db) {
      return res.status(500).json({ success: false, error: 'Database connection failed' });
    }

    const collection = db.collection('activity_logs');
    const activityLog = {
      ...req.body,
      created_at: new Date(),
      id: Date.now().toString()
    };

    // If video data is included in the body, store it as binary data
    if (req.body.video_blob) {
      if (typeof req.body.video_blob === 'string' && req.body.video_blob.startsWith('data:video/')) {
        activityLog.video_data = Buffer.from(req.body.video_blob.split(',')[1], 'base64');
        activityLog.video_mime_type = req.body.video_blob.split(',')[0].split(':')[1].split(';')[0];
      } else if (Buffer.isBuffer(req.body.video_blob)) {
        activityLog.video_data = req.body.video_blob;
        activityLog.video_mime_type = req.body.video_mime_type || 'video/webm';
      }
    }

    const result = await collection.insertOne(activityLog);

    // Also save to server_logs collection
    if (activityLog.video_data) {
      const serverLogsCollection = db.collection('server_logs');
      const serverLogEntry = {
        activity_log_id: result.insertedId.toString(),
        type: 'video_storage',
        candidate_id: activityLog.candidate_id,
        candidate_email: activityLog.candidate_email,
        job_position: activityLog.job_position,
        video_data: activityLog.video_data,
        video_mime_type: activityLog.video_mime_type,
        video_size_bytes: activityLog.video_data.length,
        stored_at: new Date(),
        collection: 'activity_logs'
      };

      await serverLogsCollection.insertOne(serverLogEntry);
    }

    res.json({
      success: true,
      id: result.insertedId,
      data: activityLog
    });

  } catch (error) {
    console.error('Error saving activity log:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/activity-logs/:id/video', async (req, res) => {
  try {
    const db = await connectMongoDB();
    if (!db) {
      return res.status(500).json({ success: false, error: 'Database connection failed' });
    }

    // First try activity_logs collection
    const activityLogsCollection = db.collection('activity_logs');
    let videoDoc = await activityLogsCollection.findOne({ id: req.params.id });

    // If not found in activity_logs, try server_logs
    if (!videoDoc || !videoDoc.video_data) {
      const serverLogsCollection = db.collection('server_logs');
      videoDoc = await serverLogsCollection.findOne({
        activity_log_id: req.params.id,
        type: 'video_storage'
      });
    }

    if (!videoDoc || !videoDoc.video_data) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.setHeader('Content-Type', videoDoc.video_mime_type || 'video/webm');
    res.setHeader('Content-Length', videoDoc.video_data.length);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.send(videoDoc.video_data);

  } catch (error) {
    console.error('Error retrieving video:', error);
    res.status(500).json({ error: error.message });
  }
});

// Email endpoint
app.post('/send-email', async (req, res) => {
  try {
    const { to, subject, html, from } = req.body;

    console.log('Sending email to:', to);

    const emailResponse = await resend.emails.send({
      from: from || 'HireZen HR <hr@gradia.co.in>',
      to: [to],
      subject: subject || 'Your Resume Has Been Received',
      html: html,
    });

    console.log('Email sent successfully:', emailResponse);
    res.json({ success: true, emailId: emailResponse.id });

  } catch (error) {
    console.error('Email sending failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'HireZen Server (Vercel)',
    mode: 'production',
    timestamp: new Date().toISOString()
  });
});

// Export for Vercel
export default app;