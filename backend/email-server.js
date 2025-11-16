import express from 'express';
import cors from 'cors';
import { Resend } from 'resend';
import { MongoClient, GridFSBucket, ObjectId } from 'mongodb';
import multer from 'multer';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3002;

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'hirezen';
let mongoClient;
let gfsBucket;
let upload;

// CORS Configuration - Allow specific origins
const allowedOrigins = [
  'https://hirezen-dv1h.vercel.app', // Production frontend
  'https://hirezen-dv1h.vercel.app/',
  'http://localhost:5173',            // Local Vite dev (current)
  'http://localhost:5179',            // Alternative local port
  'http://localhost:3000',            // Alternative local port
  'http://localhost:8080'             // Alternative local port
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like curl or same-origin)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'Accept', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400
}));

// Allow preflight for all routes
app.options('*', cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY || 're_NZzC538G_L44QCHEyZmkmJBy7JMBqkypF');

// Connect to MongoDB and initialize GridFS
async function connectMongoDB() {
  try {
    if (mongoClient && gfsBucket) return mongoClient.db(DB_NAME);

    console.log('🔌 Connecting to MongoDB Atlas...');
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();

    const db = mongoClient.db(DB_NAME);

    // Initialize GridFS bucket for videos
    gfsBucket = new GridFSBucket(db, {
      bucketName: 'videos'
    });

    // Initialize upload middleware
    upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 500 * 1024 * 1024, // 500MB limit
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['video/webm', 'video/mp4'];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Only .webm and .mp4 video files are allowed'));
        }
      }
    });

    console.log('📋 Multer initialized for video uploads');

    console.log('✅ MongoDB Atlas connected successfully!');
    console.log('🎬 GridFS bucket "videos" initialized');
    console.log('📊 Database: hirezen');

    // Test collections
    const collections = await db.collections();
    console.log(`📋 Available collections: ${collections.map(c => c.collectionName).join(', ')}`);

    return db;
  } catch (error) {
    console.error('❌ MongoDB Atlas connection error:', error.message);
    console.error('🔍 Connection string:', MONGODB_URI.replace(/:([^:@]{4})[^:@]*@/, ':$1****@')); // Hide password
    return null;
  }
}

// Interview results endpoints
app.post('/interview-results', async (req, res) => {
  try {
    console.log('📥 Received interview results request:', {
      candidate_email: req.body.candidate_email,
      candidate_name: req.body.candidate_name,
      interview_score: req.body.interview_score,
      has_video: !!req.body.video_data
    });

    const db = await connectMongoDB();
    if (!db) {
      console.error('❌ MongoDB connection failed');
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

    // Remove video data from the main document but keep metadata
    const videoData = interviewData.video_data;
    const videoMimeType = interviewData.video_mime_type;
    delete interviewData.video_data; // Don't store in main document
    delete interviewData.video_mime_type;

    const result = await collection.insertOne(interviewData);
    console.log('✅ Interview results saved to MongoDB:', result.insertedId);
    console.log('📊 Saved data for candidate:', req.body.candidate_email, 'Score:', req.body.interview_score);

    // If video data exists, store it separately (optional)
    if (videoData && videoMimeType) {
      console.log('🎥 Video data provided but not storing in database (as requested)');
    }

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

// Get single interview result by ID
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

    // Also add server_logs video information if videos are stored there
    const serverLogsCollection = db.collection('server_logs');
    for (let log of logs) {
      if (log.has_video) {
        const serverLogVideo = await serverLogsCollection.findOne({
          activity_log_id: log.id,
          type: 'video_storage'
        }, {
          projection: {
            video_size_bytes: 1,
            video_size_mb: 1,
            stored_at: 1
          }
        });

        if (serverLogVideo) {
          log.server_logs_video = {
            size_bytes: serverLogVideo.video_size_bytes,
            size_mb: serverLogVideo.video_size_mb,
            stored_at: serverLogVideo.stored_at
          };
        }
      }
    }

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


// Original endpoint (keeping for backward compatibility)
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
      id: Date.now().toString() // Simple ID generation
    };

    // If video data is included in the body, store it as binary data
    if (req.body.video_blob) {
      // Convert base64 or handle the blob data
      // Assuming req.body.video_blob is a base64 string or buffer
      if (typeof req.body.video_blob === 'string' && req.body.video_blob.startsWith('data:video/')) {
        // Handle base64 video data
        const base64Data = req.body.video_blob.split(',')[1];
        activityLog.video_data = Buffer.from(base64Data, 'base64');
        activityLog.video_mime_type = req.body.video_blob.split(',')[0].split(':')[1].split(';')[0];
      } else if (Buffer.isBuffer(req.body.video_blob)) {
        // Handle binary buffer
        activityLog.video_data = req.body.video_blob;
        activityLog.video_mime_type = req.body.video_mime_type || 'video/webm';
      }
    }

    const result = await collection.insertOne(activityLog);
    console.log('Activity log saved to MongoDB:', result.insertedId);
    console.log('Video data stored:', !!activityLog.video_data);

    // Also save to server_logs collection as requested
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
        video_size_mb: activityLog.video_size_mb,
        interview_score: activityLog.interview_score,
        stored_at: new Date(),
        collection: 'activity_logs',
        metadata: {
          video_url: activityLog.video_url,
          interview_details: activityLog.interview_details,
          user_agent: req.headers['user-agent'],
          ip_address: req.ip || req.connection.remoteAddress
        }
      };

      const serverLogResult = await serverLogsCollection.insertOne(serverLogEntry);
      console.log('Video also saved to server_logs collection:', serverLogResult.insertedId);
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

// Get video endpoint - retrieve video from MongoDB
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

    // Set appropriate headers
    res.setHeader('Content-Type', videoDoc.video_mime_type || 'video/webm');
    res.setHeader('Content-Length', videoDoc.video_data.length);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

    // Send the video data
    res.send(videoDoc.video_data);

  } catch (error) {
    console.error('Error retrieving video:', error);
    res.status(500).json({ error: error.message });
  }
});

// Attach video metadata to existing activity log
app.post('/activity-logs/:id/attach-video', async (req, res) => {
  try {
    const { fileId, fileUrl, mimeType, size } = req.body;
    const id = req.params.id;
    const db = await connectMongoDB();
    if (!db) {
      return res.status(500).json({ success: false, error: 'Database connection failed' });
    }

    const collection = db.collection('activity_logs');
    const update = {
      $set: {
        video_file_id: fileId,
        video_url: fileUrl,
        video_mime_type: mimeType,
        video_size_bytes: size,
        video_recorded: true,
        video_stored_in_db: true,
        updated_at: new Date()
      }
    };

    const result = await collection.updateOne({ id }, update);

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, error: 'Activity log not found' });
    }

    res.json({ success: true, message: 'Video metadata attached to activity log' });

  } catch (error) {
    console.error('Error attaching video to activity log:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Video upload endpoint - Upload video file to GridFS
app.post('/upload-video', (req, res, next) => {
  if (!upload) {
    console.log('❌ Upload middleware not initialized');
    return res.status(500).json({ success: false, error: 'Upload service not ready' });
  }
  upload.single('video')(req, res, next);
}, async (req, res) => {
  try {
    console.log('📥 Upload request received');
    console.log('📄 Request body keys:', Object.keys(req.body));
    console.log('📁 Files:', req.file ? 'present' : 'missing');

    // Check if MongoDB and GridFS are initialized
    if (!mongoClient || !gfsBucket) {
      console.error('❌ MongoDB or GridFS not initialized');
      return res.status(500).json({
        success: false,
        error: 'Database service not ready'
      });
    }

    if (!req.file) {
      console.log('❌ No file in request');
      return res.status(400).json({
        success: false,
        error: 'No video file uploaded'
      });
    }

    console.log('📥 Processing uploaded video file:', {
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      buffer: req.file.buffer?.length || 'no buffer'
    });

    // Verify backend base URL is configured
    const backendBaseUrl = process.env.BACKEND_BASE_URL;
    if (!backendBaseUrl) {
      console.error('❌ BACKEND_BASE_URL environment variable not set');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error - BACKEND_BASE_URL not configured'
      });
    }

    console.log('🔗 Using backend base URL:', backendBaseUrl);

    // Manually upload to GridFS since multer-gridfs-storage is problematic
    try {
      const filename = `${Date.now()}-interview-video${path.extname(req.file.originalname) || '.webm'}`;
      const uploadStream = gfsBucket.openUploadStream(filename, {
        metadata: {
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          uploadDate: new Date(),
          size: req.file.size,
          // Additional metadata from request body
          candidateId: req.body.candidateId,
          candidateName: req.body.candidateName,
          candidateEmail: req.body.candidateEmail,
          jobId: req.body.jobId,
          jobPosition: req.body.jobPosition,
          sessionId: req.body.sessionId
        }
      });

      uploadStream.write(req.file.buffer);
      uploadStream.end();

      const fileId = await new Promise((resolve, reject) => {
        uploadStream.on('finish', () => resolve(uploadStream.id));
        uploadStream.on('error', reject);
      });

      console.log('✅ Video uploaded to GridFS with ID:', fileId);

      // Verify the file was stored
      const files = await gfsBucket.find({ _id: fileId }).toArray();
      if (files.length === 0) {
        console.error('❌ File not found in GridFS after upload!');
        return res.status(500).json({
          success: false,
          error: 'File upload failed - not found in database'
        });
      }

      console.log('✅ File verified in GridFS:', files[0]._id.toString());

      res.json({
        success: true,
        fileId: fileId,
        filename: filename,
        size: req.file.size,
        mimeType: req.file.mimetype,
        fileUrl: `${backendBaseUrl}/video/${fileId}`,
        message: 'Video uploaded successfully to GridFS'
      });

    } catch (gridfsError) {
      console.error('❌ GridFS upload error:', gridfsError);
      res.status(500).json({
        success: false,
        error: 'GridFS upload failed: ' + gridfsError.message
      });
    }

  } catch (error) {
    console.error('❌ Error uploading video:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Stream video from GridFS
app.get('/video/:id', async (req, res) => {
  try {
    const fileId = req.params.id;

    if (!ObjectId.isValid(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    // Find file in GridFS
    const files = await gfsBucket.find({ _id: new ObjectId(fileId) }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const file = files[0];

    // Set appropriate headers
    res.setHeader('Content-Type', file.metadata?.mimeType || 'video/webm');
    res.setHeader('Content-Length', file.length);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

    // Handle range requests for video seeking
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : file.length - 1;
      const chunksize = (end - start) + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${file.length}`);
      res.setHeader('Content-Length', chunksize);

      // Stream specific range
      const downloadStream = gfsBucket.openDownloadStream(file._id, {
        start: start,
        end: end + 1
      });
      downloadStream.pipe(res);
    } else {
      // Stream entire file
      const downloadStream = gfsBucket.openDownloadStream(file._id);
      downloadStream.pipe(res);
    }

  } catch (error) {
    console.error('❌ Error streaming video:', error);
    res.status(500).json({ error: error.message });
  }
});

// Force download video from GridFS
app.get('/video/download/:id', async (req, res) => {
  try {
    const fileId = req.params.id;

    if (!ObjectId.isValid(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    // Find file in GridFS
    const files = await gfsBucket.find({ _id: new ObjectId(fileId) }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const file = files[0];
    const filename = file.filename || `interview-video-${fileId}.webm`;

    // Set headers for download
    res.setHeader('Content-Type', file.metadata?.mimeType || 'video/webm');
    res.setHeader('Content-Length', file.length);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Stream file for download
    const downloadStream = gfsBucket.openDownloadStream(file._id);
    downloadStream.pipe(res);

  } catch (error) {
    console.error('❌ Error downloading video:', error);
    res.status(500).json({ error: error.message });
  }
});

// List all uploaded videos (for debugging/admin purposes)
app.get('/videos', async (req, res) => {
  try {
    const files = await gfsBucket.find().sort({ uploadDate: -1 }).limit(50).toArray();

    const videos = files.map(file => ({
      id: file._id,
      filename: file.filename,
      size: file.length,
      sizeMB: (file.length / (1024 * 1024)).toFixed(2),
      uploadDate: file.uploadDate,
      mimeType: file.metadata?.mimeType,
      metadata: {
        candidateId: file.metadata?.candidateId,
        candidateName: file.metadata?.candidateName,
        candidateEmail: file.metadata?.candidateEmail,
        jobId: file.metadata?.jobId,
        jobPosition: file.metadata?.jobPosition,
        sessionId: file.metadata?.sessionId
      }
    }));

    res.json({
      success: true,
      videos: videos,
      count: videos.length
    });

  } catch (error) {
    console.error('❌ Error listing videos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
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

// Video storage disabled in simplified mode



// Simple HTML page for video analysis and auto-fill
app.get('/video-analysis', (req, res) => {
  // Check if there's a session ID in query params for direct video access
  const requestedSessionId = req.query.session;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Video Analysis - HireZen</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .video-item { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 8px; }
        .video-info { margin-bottom: 10px; }
        .analysis-form { margin-top: 20px; }
        input, textarea, select { width: 100%; padding: 8px; margin: 5px 0; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #2563eb; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #1d4ed8; }
        .auto-fill-btn { background: #059669; margin-left: 10px; }
        .auto-fill-btn:hover { background: #047857; }
        .video-preview { max-width: 300px; margin: 10px 0; }
        .analysis-result { background: #f3f4f6; padding: 10px; border-radius: 4px; margin-top: 10px; }
    </style>
</head>
<body>
    <h1>Video Analysis Dashboard</h1>
    <p>Analyze recorded interview videos and extract information automatically.</p>

    <div id="videos-list">
        <h2>Uploaded Videos</h2>
        ${requestedSessionId ? `<div class="video-item" style="border: 2px solid #2563eb; background: #eff6ff;"><strong>Requested Video:</strong> ${requestedSessionId}</div>` : ''}
        <div id="videos-container">
            <p>Loading videos...</p>
        </div>
    </div>

    <div class="analysis-form">
        <h2>Analysis Form</h2>
        <form id="analysis-form">
            <div>
                <label for="video-select">Select Video:</label>
                <select id="video-select" required>
                    <option value="">Choose a video...</option>
                </select>
            </div>

            <div>
                <label for="candidate-name">Candidate Name:</label>
                <input type="text" id="candidate-name" placeholder="Will be auto-filled from video analysis">
                <button type="button" class="auto-fill-btn" onclick="autoFillField('candidate-name')">Auto Fill</button>
            </div>

            <div>
                <label for="candidate-email">Candidate Email:</label>
                <input type="email" id="candidate-email" placeholder="Will be auto-filled from video analysis">
                <button type="button" class="auto-fill-btn" onclick="autoFillField('candidate-email')">Auto Fill</button>
            </div>

            <div>
                <label for="job-position">Job Position:</label>
                <input type="text" id="job-position" placeholder="Will be auto-filled from video analysis">
                <button type="button" class="auto-fill-btn" onclick="autoFillField('job-position')">Auto Fill</button>
            </div>

            <div>
                <label for="interview-notes">Interview Notes:</label>
                <textarea id="interview-notes" rows="4" placeholder="Detailed notes will be auto-filled from video analysis"></textarea>
                <button type="button" class="auto-fill-btn" onclick="autoFillField('interview-notes')">Auto Fill</button>
            </div>

            <div>
                <label for="overall-rating">Overall Rating (1-10):</label>
                <input type="number" id="overall-rating" min="1" max="10" placeholder="Will be auto-filled from video analysis">
                <button type="button" class="auto-fill-btn" onclick="autoFillField('overall-rating')">Auto Fill</button>
            </div>

            <button type="submit">Save Analysis</button>
        </form>
    </div>

    <div id="analysis-result" class="analysis-result" style="display: none;">
        <h3>Analysis Result</h3>
        <pre id="result-json"></pre>
    </div>

    <script>
        let videos = [];

        async function loadVideos() {
            try {
                const response = await fetch('/uploaded-videos');
                const data = await response.json();

                videos = data.videos;
                const container = document.getElementById('videos-container');
                const select = document.getElementById('video-select');

                if (videos.length === 0) {
                    container.innerHTML = '<p>No videos uploaded yet.</p>';
                    return;
                }

                container.innerHTML = '';
                select.innerHTML = '<option value="">Choose a video...</option>';

                videos.forEach(video => {
                    // Add to list
                    const videoDiv = document.createElement('div');
                    videoDiv.className = 'video-item';
                    videoDiv.innerHTML = \`
                        <div class="video-info">
                            <strong>Session:</strong> \${video.sessionId.substring(0, 16)}...<br>
                            <strong>Candidate:</strong> \${video.candidateName}<br>
                            <strong>Email:</strong> \${video.candidateEmail}<br>
                            <strong>Position:</strong> \${video.jobPosition}<br>
                            <strong>Size:</strong> \${video.sizeMB}MB<br>
                            <strong>Uploaded:</strong> \${new Date(video.uploadedAt).toLocaleString()}
                        </div>
                        <video class="video-preview" controls>
                            <source src="/interview-video/\${video.sessionId}" type="video/webm">
                            Your browser does not support the video tag.
                        </video>
                    \`;
                    container.appendChild(videoDiv);

                    // Add to select
                    const option = document.createElement('option');
                    option.value = video.sessionId;
                    option.textContent = \`\${video.candidateName} - \${video.jobPosition} (\${video.sizeMB}MB)\`;
                    select.appendChild(option);
                });

            } catch (error) {
                console.error('Error loading videos:', error);
                document.getElementById('videos-container').innerHTML = '<p>Error loading videos.</p>';
            }
        }

        async function autoFillField(fieldId) {
            const select = document.getElementById('video-select');
            const selectedSessionId = select.value;

            if (!selectedSessionId) {
                alert('Please select a video first');
                return;
            }

            const selectedVideo = videos.find(v => v.sessionId === selectedSessionId);
            if (!selectedVideo) {
                alert('Video not found');
                return;
            }

            try {
                // Simulate AI analysis - in real implementation, this would call an AI service
                const mockAnalysis = await simulateVideoAnalysis(selectedVideo, fieldId);

                document.getElementById(fieldId).value = mockAnalysis;
                document.getElementById(fieldId).dispatchEvent(new Event('input', { bubbles: true }));

            } catch (error) {
                console.error('Error analyzing video:', error);
                alert('Error analyzing video. Please try again.');
            }
        }

        async function simulateVideoAnalysis(video, fieldId) {
            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

            // Mock analysis based on field type
            switch(fieldId) {
                case 'candidate-name':
                    return video.candidateName || 'John Doe';
                case 'candidate-email':
                    return video.candidateEmail || 'john.doe@email.com';
                case 'job-position':
                    return video.jobPosition || 'Software Engineer';
                case 'interview-notes':
                    return \`Candidate demonstrated good communication skills and technical knowledge. The interview covered key aspects of the \${video.jobPosition} role. Candidate showed enthusiasm and provided relevant examples from their experience. Overall performance was solid with room for improvement in specific technical areas.\`;
                case 'overall-rating':
                    return Math.floor(Math.random() * 4) + 7; // Random rating 7-10
                default:
                    return 'Analysis not available';
            }
        }

        document.getElementById('analysis-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(e.target);
            const analysis = {
                sessionId: formData.get('video-select'),
                candidateName: formData.get('candidate-name'),
                candidateEmail: formData.get('candidate-email'),
                jobPosition: formData.get('job-position'),
                interviewNotes: formData.get('interview-notes'),
                overallRating: formData.get('overall-rating'),
                analyzedAt: new Date().toISOString()
            };

            document.getElementById('result-json').textContent = JSON.stringify(analysis, null, 2);
            document.getElementById('analysis-result').style.display = 'block';

            alert('Analysis saved successfully!');
        });

        // Load videos when page loads
        loadVideos();

        // If a specific session was requested, auto-select it
        ${requestedSessionId ? `setTimeout(() => {
            const select = document.getElementById('video-select');
            if (select) {
                select.value = '${requestedSessionId}';
                select.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, 1000);` : ''}
    </script>
</body>
</html>`;
  res.send(html);
});

// Health check
app.get('/health', async (req, res) => {
  try {
    const db = await connectMongoDB();
    const dbStatus = db ? 'connected' : 'disconnected';

    // Test database operations
    let collections = [];
    if (db) {
      collections = await db.collections();
    }

    res.json({
      status: 'OK',
      message: 'HireZen Backend Server (MongoDB Atlas)',
      mode: 'production',
      database: dbStatus,
      gridfs: gfsBucket ? 'initialized' : 'not initialized',
      collections: collections.map(c => c.collectionName),
      mongodb_uri: MONGODB_URI ? 'configured' : 'missing',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Initialize server with MongoDB connection
async function initializeServer() {
  console.log('🚀 Starting HireZen Server...');

  // Test MongoDB connection
  try {
    const db = await connectMongoDB();
    if (db) {
      console.log('✅ MongoDB connected successfully!');
      console.log('📊 Database: hirezen');
      console.log('💾 Interview data storage: Enabled');
    } else {
      console.log('❌ MongoDB connection failed!');
      console.log('⚠️  Server will continue but data storage disabled');
    }
  } catch (error) {
    console.error('❌ MongoDB initialization error:', error.message);
  }

  app.listen(PORT, () => {
    console.log(`📧 HireZen Server running on port ${PORT}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log(`✉️  Email service: Ready`);
    console.log(`📝 Interview results storage: Ready`);
    console.log(`📋 Activity logs: Ready`);
    console.log(`🎬 Video server: GridFS enabled`);
    console.log(`📤 Upload: POST /upload-video`);
    console.log(`🎥 Stream: GET /video/:id`);
    console.log(`⬇️ Download: GET /video/download/:id`);
    console.log(`📋 Videos list: GET /videos`);
    console.log('✅ GridFS upload initialized:', !!upload);
    console.log(` Frontend expected at: http://localhost:8080`);
  });
}

initializeServer().catch(error => {
  console.error('❌ Server startup failed:', error);
  process.exit(1);
});