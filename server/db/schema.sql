CREATE DATABASE IF NOT EXISTS `karta`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `karta`;

CREATE TABLE IF NOT EXISTS territories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_number INT NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  assigned_to VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS territory_points (
  id INT AUTO_INCREMENT PRIMARY KEY,
  territory_id INT NOT NULL,
  point_order INT NOT NULL,
  lat DECIMAL(10, 7) NOT NULL,
  lon DECIMAL(10, 7) NOT NULL,
  CONSTRAINT fk_territory_points_territory
    FOREIGN KEY (territory_id) REFERENCES territories(id)
    ON DELETE CASCADE,
  UNIQUE KEY territory_point_order_unique (territory_id, point_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS map_objects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_number INT NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(255) NOT NULL,
  subcategory VARCHAR(255) NOT NULL,
  address VARCHAR(255) NULL,
  description TEXT NULL,
  lat DECIMAL(10, 7) NULL,
  lon DECIMAL(10, 7) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  photo_path VARCHAR(500) NULL,
  address VARCHAR(255) NULL,
  lat DECIMAL(10, 7) NULL,
  lon DECIMAL(10, 7) NULL,
  status ENUM('new', 'in_progress', 'done', 'rejected') NOT NULL DEFAULT 'new',
  status_updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_service_requests_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) NOT NULL,
  expires INT UNSIGNED NOT NULL,
  data MEDIUMTEXT,
  PRIMARY KEY (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
