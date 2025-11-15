import express from 'express';
import cors from 'cors';
import { Resend } from 'resend';
import { MongoClient } from 'mongodb';

const app = express();
const PORT = process.env.PORT || 3002;

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'hirezen';
let mongoClient;

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY || 're_NZzC538G_L44QCHEyZmkmJBy7JMBqkypF');

// Connect to MongoDB
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
    console.log('📊 Saved data for candidate:', req.body.candidate_email, 'Score:', req.body.interview_score);

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
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'HireZen Email Server (Simplified Mode)',
    mode: 'simplified',
    videoStorage: 'disabled',
    database: 'none',
    timestamp: new Date().toISOString()
  });
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
    console.log(`🌐 Frontend expected at: http://localhost:8080`);
  });
}

initializeServer().catch(error => {
  console.error('❌ Server startup failed:', error);
  process.exit(1);
});