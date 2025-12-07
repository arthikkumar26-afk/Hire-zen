import { z } from 'zod';

// Common schemas
export const mongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId');

export const emailSchema = z.string().email('Invalid email address');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10).optional(),
});

// Interview Results Schemas
export const createInterviewResultSchema = z.object({
  candidate_name: z.string().min(1, 'Candidate name is required'),
  candidate_email: emailSchema,
  job_position: z.string().min(1, 'Job position is required').optional(),
  interview_type: z.string().optional(),
  score: z.number().min(0).max(100).optional(),
  feedback: z.string().optional(),
  video_url: z.string().url('Invalid video URL').optional().or(z.literal('')),
  created_at: z.string().datetime().optional(),
});

export const interviewResultIdSchema = z.object({
  id: mongoIdSchema,
});

// Activity Logs Schemas
export const createActivityLogSchema = z.object({
  candidate_name: z.string().min(1, 'Candidate name is required'),
  candidate_email: emailSchema.optional(),
  job_position: z.string().optional(),
  old_stage: z.string().optional(),
  new_stage: z.string().min(1, 'New stage is required'),
  old_stage_label: z.string().optional(),
  new_stage_label: z.string().min(1, 'New stage label is required'),
  changed_by_name: z.string().min(1, 'Changed by name is required'),
  interview_score: z.number().min(0).max(100).optional(),
  interview_details: z.any().optional(),
});

export const activityLogIdSchema = z.object({
  id: mongoIdSchema,
});

// Video Schemas
export const videoIdSchema = z.object({
  id: z.string().min(1, 'Video ID is required'),
});

export const attachVideoSchema = z.object({
  id: mongoIdSchema,
}).merge(z.object({
  video_url: z.string().url('Invalid video URL'),
  video_size: z.number().positive().optional(),
}));

// Email Schemas
export const sendEmailSchema = z.object({
  to: emailSchema,
  subject: z.string().min(1, 'Subject is required'),
  html: z.string().min(1, 'HTML content is required'),
  from: z.string().email('Invalid from email').optional(),
  replyTo: z.string().email('Invalid reply-to email').optional(),
});

// Query schemas
export const interviewResultsQuerySchema = paginationSchema.extend({
  candidate_email: emailSchema.optional(),
  job_position: z.string().optional(),
});

export const activityLogsQuerySchema = paginationSchema.extend({
  candidate_email: emailSchema.optional(),
  stage: z.string().optional(),
});

export const videosQuerySchema = paginationSchema.extend({
  candidate_email: emailSchema.optional(),
});

// Interview Videos Schemas
export const createInterviewVideoSchema = z.object({
  candidate_name: z.string().min(1, 'Candidate name is required'),
  candidate_email: emailSchema,
  job_position: z.string().optional(),
  session_id: z.string().min(1, 'Session ID is required'),
  video_url: z.string().url('Invalid video URL').optional(),
  video_size: z.number().positive().optional(),
});

export const interviewVideoIdSchema = z.object({
  id: mongoIdSchema,
});

