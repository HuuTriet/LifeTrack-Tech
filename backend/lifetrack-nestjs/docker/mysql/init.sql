-- LifeTrack Tech — MySQL Init Script
-- Creates the database with correct charset and timezone

CREATE DATABASE IF NOT EXISTS `lifetrack_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `lifetrack_db`;

-- Set timezone
SET time_zone = '+07:00';

-- Grant full privileges (for development only)
GRANT ALL PRIVILEGES ON `lifetrack_db`.* TO 'root'@'%';
FLUSH PRIVILEGES;
