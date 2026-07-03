-- Drop existing tables if they exist (for development)
DROP TABLE IF EXISTS email_logs CASCADE;
DROP TABLE IF EXISTS summaries CASCADE;
DROP TABLE IF EXISTS news_items CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;

-- News Items Table
CREATE TABLE news_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  url TEXT UNIQUE NOT NULL,
  source VARCHAR(50) NOT NULL CHECK (source IN ('twitter', 'rss', 'reddit')),
  source_url TEXT,
  author VARCHAR(255),
  published_at TIMESTAMP NOT NULL,
  fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  topic_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  content TEXT,
  image_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_url_source UNIQUE(url, source)
);

CREATE INDEX idx_news_published_at ON news_items(published_at DESC);
CREATE INDEX idx_news_source ON news_items(source);
CREATE INDEX idx_news_topic_tags ON news_items USING GIN(topic_tags);
CREATE INDEX idx_news_fetched_at ON news_items(fetched_at DESC);

-- Summaries Table
CREATE TABLE summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  day_of_week VARCHAR(20) NOT NULL,
  topic_name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  model VARCHAR(50) NOT NULL,
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_date_topic UNIQUE(date, topic_name)
);

CREATE INDEX idx_summaries_date ON summaries(date DESC);
CREATE INDEX idx_summaries_day_of_week ON summaries(day_of_week);
CREATE INDEX idx_summaries_generated_at ON summaries(generated_at DESC);

-- Email Logs Table
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMP,
  error TEXT,
  summary_ids UUID[] DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_logs_date ON email_logs(date DESC);
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_email_logs_sent_at ON email_logs(sent_at DESC);
CREATE INDEX idx_email_logs_recipient ON email_logs(recipient);

-- User Preferences Table
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_global BOOLEAN NOT NULL DEFAULT true,
  user_id UUID,
  keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  exclude_keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  preferred_sources TEXT[] DEFAULT ARRAY['twitter', 'rss', 'reddit']::TEXT[],
  style VARCHAR(50) DEFAULT 'balanced' CHECK (style IN ('brief', 'detailed', 'balanced')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_preference UNIQUE(is_global, user_id)
);

CREATE INDEX idx_preferences_is_global ON user_preferences(is_global);
CREATE INDEX idx_preferences_user_id ON user_preferences(user_id);
