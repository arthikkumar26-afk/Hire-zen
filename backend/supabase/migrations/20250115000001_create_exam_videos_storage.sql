-- Create storage bucket for exam videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exam-videos',
  'exam-videos',
  false, -- Private bucket
  524288000, -- 500MB limit per file
  ARRAY['video/webm', 'video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for exam videos
-- Allow authenticated users to upload exam videos
CREATE POLICY "Allow authenticated users to upload exam videos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'exam-videos');

-- Allow authenticated users to view exam videos
CREATE POLICY "Allow authenticated users to view exam videos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'exam-videos');

-- Allow service role to manage all exam videos
CREATE POLICY "Service role can manage exam videos"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'exam-videos');

