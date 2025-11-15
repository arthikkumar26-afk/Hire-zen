import express from 'express';
import { GridFSBucket } from 'mongodb';
import multer from 'multer';
import { GridFsStorage } from 'multer-gridfs-storage';

const router = express.Router();

// Ensure mongoose connection is available from the main app
// This will be passed from the main server file
let gfsBucket;
let storage;
let upload;

export function initializeGridFS(db) {
  // Create GridFS bucket for videos
  gfsBucket = new GridFSBucket(db, {
    bucketName: 'videos'
  });

  // Configure multer-gridfs-storage
  storage = new GridFsStorage({
    url: process.env.MONGODB_URI || 'mongodb://localhost:27017/hirezen',
    options: { useNewUrlParser: true, useUnifiedTopology: true },
    file: (req, file) => {
      return new Promise((resolve, reject) => {
        // Generate unique filename
        const filename = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${file.originalname ? file.originalname.substring(file.originalname.lastIndexOf('.')) : '.webm'}`;
        const fileInfo = {
          filename: filename,
          bucketName: 'videos',
          metadata: {
            originalName: file.originalname,
            mimeType: file.mimetype,
            uploadDate: new Date(),
            candidateId: req.body.candidateId,
            candidateName: req.body.candidateName,
            candidateEmail: req.body.candidateEmail,
            jobId: req.body.jobId,
            jobPosition: req.body.jobPosition,
            sessionId: req.body.sessionId,
            size: file.size
          }
        };
        resolve(fileInfo);
      });
    }
  });

  upload = multer({
    storage: storage,
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB limit
    },
    fileFilter: (req, file, cb) => {
      // Accept video files
      if (file.mimetype.startsWith('video/')) {
        cb(null, true);
      } else {
        cb(new Error('Only video files are allowed'));
      }
    }
  });
}

// Initialize multer with memory storage as fallback
const memoryStorage = multer.memoryStorage();
const memoryUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept video files
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
});

// POST /upload - Upload video file to GridFS
router.post('/upload', (upload ? upload.single('video') : memoryUpload.single('video')), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No video file uploaded'
      });
    }

    console.log('🎬 Video uploaded successfully to GridFS:', {
      filename: req.file.filename,
      size: req.file.size,
      id: req.file.id
    });

    res.json({
      success: true,
      filename: req.file.filename,
      id: req.file.id,
      size: req.file.size,
      message: 'Video uploaded successfully'
    });

  } catch (error) {
    console.error('❌ Error uploading video:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /video/:filename - Stream video from GridFS
router.get('/video/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;

    // Find file in GridFS
    const files = await gfsBucket.find({ filename: filename }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({
        error: 'Video not found'
      });
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
    res.status(500).json({
      error: error.message
    });
  }
});

// GET /videos - List all uploaded videos (for debugging/admin purposes)
router.get('/videos', async (req, res) => {
  try {
    const files = await gfsBucket.find().sort({ uploadDate: -1 }).limit(50).toArray();

    const videos = files.map(file => ({
      id: file._id,
      filename: file.filename,
      size: file.length,
      uploadDate: file.uploadDate,
      metadata: file.metadata
    }));

    res.json({
      success: true,
      videos: videos
    });

  } catch (error) {
    console.error('❌ Error listing videos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;