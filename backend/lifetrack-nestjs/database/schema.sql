-- ============================================================
-- LifeTrack Tech — MySQL DDL Schema
-- Version: 1.0.0 | Charset: utf8mb4 | Timezone: +07:00
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '+07:00';
SET foreign_key_checks = 0;

CREATE DATABASE IF NOT EXISTS `lifetrack_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `lifetrack_db`;

-- ============================================================
-- DOMAIN 1: AUTH
-- ============================================================

CREATE TABLE IF NOT EXISTS `users` (
  `id`            VARCHAR(36)   NOT NULL DEFAULT (UUID()),
  `full_name`     VARCHAR(100)  NOT NULL,
  `email`         VARCHAR(255)  NOT NULL,
  `phone_number`  VARCHAR(255)  NULL,
  `password`      VARCHAR(255)  NOT NULL,
  `role`          ENUM('ADMIN','CAREGIVER','ELDERLY','FAMILY') NOT NULL DEFAULT 'ELDERLY',
  `status`        ENUM('ACTIVE','INACTIVE','SUSPENDED','PENDING_VERIFICATION') NOT NULL DEFAULT 'PENDING_VERIFICATION',
  `avatar_url`    VARCHAR(500)  NULL,
  `refresh_token` VARCHAR(500)  NULL,
  `email_verified`    TINYINT(1)    NOT NULL DEFAULT 0,
  `last_login_at` DATETIME      NULL,
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`    DATETIME      NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `elderly_profiles` (
  `id`                        VARCHAR(36)   NOT NULL DEFAULT (UUID()),
  `user_id`                   VARCHAR(36)   NOT NULL,
  `date_of_birth`             DATE          NULL,
  `gender`                    VARCHAR(10)   NULL COMMENT 'MALE | FEMALE | OTHER',
  `weight`                    DECIMAL(5,2)  NULL COMMENT 'kg',
  `height`                    DECIMAL(5,2)  NULL COMMENT 'cm',
  `blood_type`                ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  `known_allergies`           TEXT          NULL COMMENT 'JSON array of allergy strings',
  `chronic_conditions`        TEXT          NULL COMMENT 'JSON array of conditions',
  `emergency_contact_name`    VARCHAR(255)  NULL,
  `emergency_contact_phone`   VARCHAR(50)   NULL,
  `caregiver_id`              VARCHAR(36)   NULL COMMENT 'FK to caregiver_profiles.id (soft ref)',
  `room_number`               VARCHAR(20)   NULL,
  `created_at`                DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`                DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`                DATETIME      NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_elderly_user_id` (`user_id`),
  KEY `idx_elderly_caregiver` (`caregiver_id`),
  CONSTRAINT `fk_elderly_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `caregiver_profiles` (
  `id`                    VARCHAR(36)   NOT NULL DEFAULT (UUID()),
  `user_id`               VARCHAR(36)   NOT NULL,
  `license_number`        VARCHAR(100)  NULL,
  `certification_status`  ENUM('VERIFIED','PENDING','REJECTED') NOT NULL DEFAULT 'PENDING',
  `specialization`        VARCHAR(200)  NULL,
  `years_of_experience`   INT           NOT NULL DEFAULT 0,
  `workplace`             VARCHAR(500)  NULL,
  `bio`                   TEXT          NULL,
  `is_available`          TINYINT(1)    NOT NULL DEFAULT 1,
  `average_rating`        DECIMAL(3,2)  NOT NULL DEFAULT 0.00,
  `total_reviews`         INT           NOT NULL DEFAULT 0,
  `created_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`            DATETIME      NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_caregiver_user_id` (`user_id`),
  CONSTRAINT `fk_caregiver_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- DOMAIN 2: HEALTH
-- ============================================================

CREATE TABLE IF NOT EXISTS `vital_signs` (
  `id`                        VARCHAR(36)   NOT NULL DEFAULT (UUID()),
  `elderly_id`                VARCHAR(36)   NOT NULL,
  `blood_pressure_systolic`   INT           NULL COMMENT 'mmHg',
  `blood_pressure_diastolic`  INT           NULL COMMENT 'mmHg',
  `heart_rate`                INT           NULL COMMENT 'bpm',
  `temperature`               DECIMAL(4,1)  NULL COMMENT 'Celsius',
  `spo2`                      DECIMAL(4,1)  NULL COMMENT '% blood oxygen',
  `blood_sugar`               DECIMAL(5,2)  NULL COMMENT 'mmol/L',
  `respiratory_rate`          INT           NULL COMMENT 'breaths/min',
  `status`                    ENUM('NORMAL','WARNING','CRITICAL') NOT NULL DEFAULT 'NORMAL',
  `notes`                     TEXT          NULL,
  `recorded_by`               VARCHAR(36)   NULL COMMENT 'userId of caregiver or self',
  `device_id`                 VARCHAR(100)  NULL COMMENT 'IoT device identifier',
  `measured_at`               DATETIME      NOT NULL,
  `created_at`                DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_vitalsigns_elderly_time` (`elderly_id`, `measured_at`),
  KEY `idx_vitalsigns_status` (`status`),
  CONSTRAINT `fk_vitalsigns_elderly` FOREIGN KEY (`elderly_id`) REFERENCES `elderly_profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `health_metrics` (
  `id`               VARCHAR(36)    NOT NULL DEFAULT (UUID()),
  `elderly_id`       VARCHAR(36)    NOT NULL,
  `metric_type`      ENUM('WEIGHT','BMI','WAIST_CIRCUMFERENCE','SLEEP_DURATION',
                          'STEPS_COUNT','CALORIES_BURNED','WATER_INTAKE',
                          'PAIN_LEVEL','MOOD_SCORE','COGNITIVE_SCORE') NOT NULL,
  `value`            DECIMAL(10,3)  NOT NULL,
  `unit`             VARCHAR(20)    NOT NULL COMMENT 'kg, bpm, hours, steps, etc.',
  `trend`            ENUM('IMPROVING','STABLE','DECLINING','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  `target_min`       DECIMAL(10,3)  NULL,
  `target_max`       DECIMAL(10,3)  NULL,
  `is_within_target` TINYINT(1)     NULL,
  `notes`            TEXT           NULL,
  `recorded_at`      DATETIME       NOT NULL,
  `created_at`       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_metrics_elderly_type_time` (`elderly_id`, `metric_type`, `recorded_at`),
  CONSTRAINT `fk_metrics_elderly` FOREIGN KEY (`elderly_id`) REFERENCES `elderly_profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- DOMAIN 3: MEDICATION
-- ============================================================

CREATE TABLE IF NOT EXISTS `drugs` (
  `id`                    VARCHAR(36)   NOT NULL DEFAULT (UUID()),
  `generic_name`          VARCHAR(255)  NOT NULL,
  `brand_name`            VARCHAR(255)  NULL,
  `category`              ENUM('ANALGESIC','ANTIBIOTIC','ANTIHYPERTENSIVE','ANTICOAGULANT',
                               'ANTIDIABETIC','ANTIDEPRESSANT','ANTIPSYCHOTIC','CARDIOVASCULAR',
                               'DIURETIC','SUPPLEMENT','NSAID','SEDATIVE','OTHER') NOT NULL DEFAULT 'OTHER',
  `form`                  ENUM('TABLET','CAPSULE','LIQUID','INJECTION','PATCH',
                               'INHALER','TOPICAL','SUPPOSITORY','DROPS') NOT NULL DEFAULT 'TABLET',
  `strength`              VARCHAR(100)  NULL COMMENT 'e.g. 500mg, 10mg/5ml',
  `manufacturer`          VARCHAR(100)  NULL,
  `description`           TEXT          NULL,
  `side_effects`          TEXT          NULL,
  `contraindications`     TEXT          NULL,
  `storage_instructions`  TEXT          NULL,
  `rxnorm_code`           VARCHAR(50)   NULL COMMENT 'RxNorm code for Drug Interaction API',
  `atc_code`              VARCHAR(50)   NULL COMMENT 'ATC classification code',
  `requires_prescription` TINYINT(1)    NOT NULL DEFAULT 1,
  `is_active`             TINYINT(1)    NOT NULL DEFAULT 1,
  `image_url`             VARCHAR(500)  NULL,
  `created_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`            DATETIME      NULL,
  PRIMARY KEY (`id`),
  KEY `idx_drugs_generic_name` (`generic_name`),
  KEY `idx_drugs_brand_name` (`brand_name`),
  KEY `idx_drugs_category` (`category`),
  KEY `idx_drugs_rxnorm` (`rxnorm_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `prescriptions` (
  `id`                    VARCHAR(36)   NOT NULL DEFAULT (UUID()),
  `elderly_id`            VARCHAR(36)   NOT NULL,
  `prescription_number`   VARCHAR(100)  NULL,
  `doctor_name`           VARCHAR(200)  NULL,
  `hospital_name`         VARCHAR(200)  NULL,
  `prescribed_date`       DATE          NULL,
  `start_date`            DATE          NOT NULL,
  `end_date`              DATE          NULL,
  `status`                ENUM('ACTIVE','COMPLETED','CANCELLED','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  `source`                ENUM('DOCTOR','OCR_SCAN','MANUAL','CAREGIVER') NOT NULL DEFAULT 'MANUAL',
  `diagnosis`             TEXT          NULL,
  `notes`                 TEXT          NULL,
  `ocr_image_url`         VARCHAR(500)  NULL,
  `ocr_confidence_score`  DECIMAL(5,4)  NULL COMMENT '0.0000 to 1.0000',
  `ocr_raw_text`          TEXT          NULL,
  `created_by`            VARCHAR(36)   NULL COMMENT 'userId who created',
  `created_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`            DATETIME      NULL,
  PRIMARY KEY (`id`),
  KEY `idx_prescriptions_elderly_status` (`elderly_id`, `status`),
  KEY `idx_prescriptions_dates` (`start_date`, `end_date`),
  CONSTRAINT `fk_prescriptions_elderly` FOREIGN KEY (`elderly_id`) REFERENCES `elderly_profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `prescription_items` (
  `id`                  VARCHAR(36)    NOT NULL DEFAULT (UUID()),
  `prescription_id`     VARCHAR(36)    NOT NULL,
  `drug_id`             VARCHAR(36)    NULL COMMENT 'NULL if isGenericReminder=true',
  `drug_name_raw`       VARCHAR(255)   NULL COMMENT 'Raw name from OCR or manual input',
  `dosage`              DECIMAL(8,3)   NULL COMMENT 'NULL when unknown_dosage=true',
  `dosage_unit`         VARCHAR(20)    NULL COMMENT 'mg, ml, IU, etc.',
  `quantity`            INT            NULL COMMENT 'Pills/units per dose',
  `frequency`           ENUM('DAILY','TWICE_DAILY','THREE_TIMES_DAILY','FOUR_TIMES_DAILY',
                             'EVERY_X_HOURS','WEEKLY','AS_NEEDED') NOT NULL DEFAULT 'DAILY',
  `frequency_interval`  INT            NULL COMMENT 'For EVERY_X_HOURS: e.g. 8',
  `scheduled_times`     JSON           NULL COMMENT 'Array of HH:mm strings e.g. ["08:00","20:00"]',
  `meal_relation`       ENUM('BEFORE_MEAL','WITH_MEAL','AFTER_MEAL','INDEPENDENT') NOT NULL DEFAULT 'INDEPENDENT',
  `duration_days`       INT            NULL,
  `instructions`        TEXT           NULL,

  -- ── CORE BUSINESS FLAGS ──────────────────────────────────────
  -- unknownDosage: OCR failed to parse dosage.
  --   → bypass overdose warning; STILL run Drug Interaction Check.
  `unknown_dosage`      TINYINT(1)     NOT NULL DEFAULT 0,

  -- isGenericReminder: no drug name known; image-based reminder only.
  --   → bypass ALL safety checks; requireDisclaimer auto-set to 1.
  `is_generic_reminder` TINYINT(1)     NOT NULL DEFAULT 0,

  -- requireDisclaimer: auto-set when is_generic_reminder = 1.
  --   → frontend MUST show disclaimer.
  `require_disclaimer`  TINYINT(1)     NOT NULL DEFAULT 0,

  `reminder_image_url`  VARCHAR(500)   NULL,
  `is_active`           TINYINT(1)     NOT NULL DEFAULT 1,
  `created_at`          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pitems_prescription` (`prescription_id`),
  KEY `idx_pitems_drug` (`drug_id`),
  KEY `idx_pitems_active` (`is_active`),
  CONSTRAINT `fk_pitems_prescription` FOREIGN KEY (`prescription_id`) REFERENCES `prescriptions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pitems_drug` FOREIGN KEY (`drug_id`) REFERENCES `drugs` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `interaction_logs` (
  `id`                        VARCHAR(36)   NOT NULL DEFAULT (UUID()),
  `elderly_id`                VARCHAR(36)   NOT NULL,
  `new_drug_id`               VARCHAR(36)   NULL,
  `new_drug_name`             VARCHAR(255)  NULL,
  `existing_drug_id`          VARCHAR(36)   NULL,
  `existing_drug_name`        VARCHAR(255)  NULL,
  `severity`                  ENUM('HIGH','MODERATE','LOW','NONE') NOT NULL DEFAULT 'NONE',
  `check_status`              ENUM('BLOCKED','WARNED','PASSED','BYPASSED','ERROR') NOT NULL DEFAULT 'PASSED',
  `interaction_description`   TEXT          NULL,
  `clinical_effects`          TEXT          NULL,
  `api_raw_response`          JSON          NULL,
  `api_source`                VARCHAR(100)  NULL COMMENT 'RxNorm, OpenFDA, DrugBank, etc.',
  `checked_by`                VARCHAR(36)   NULL,
  `checked_at`                DATETIME      NOT NULL,
  `created_at`                DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_intlog_elderly_time` (`elderly_id`, `checked_at`),
  KEY `idx_intlog_severity` (`severity`, `check_status`),
  CONSTRAINT `fk_intlog_elderly` FOREIGN KEY (`elderly_id`) REFERENCES `elderly_profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- DOMAIN 4: UTILITIES
-- ============================================================

CREATE TABLE IF NOT EXISTS `reminders` (
  `id`                   VARCHAR(36)   NOT NULL DEFAULT (UUID()),
  `elderly_id`           VARCHAR(36)   NOT NULL,
  `type`                 ENUM('MEDICATION','APPOINTMENT','VITAL_CHECK',
                              'EXERCISE','HYDRATION','GENERIC') NOT NULL DEFAULT 'MEDICATION',
  `title`                VARCHAR(255)  NOT NULL,
  `description`          TEXT          NULL,
  `status`               ENUM('PENDING','SENT','ACKNOWLEDGED','MISSED','SNOOZED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `repeat`               ENUM('NONE','DAILY','WEEKLY','MONTHLY','CUSTOM') NOT NULL DEFAULT 'NONE',
  `repeat_days`          JSON          NULL COMMENT '0=Sun..6=Sat e.g. [1,3,5]',
  `scheduled_at`         DATETIME      NOT NULL,
  `sent_at`              DATETIME      NULL,
  `acknowledged_at`      DATETIME      NULL,
  `snoozed_until`        DATETIME      NULL,
  `prescription_item_id` VARCHAR(36)   NULL,
  `image_url`            VARCHAR(500)  NULL COMMENT 'For generic image-based reminders',
  `sound_enabled`        TINYINT(1)    NOT NULL DEFAULT 1,
  `vibration_enabled`    TINYINT(1)    NOT NULL DEFAULT 1,
  `caregiver_notify`     TINYINT(1)    NOT NULL DEFAULT 0 COMMENT 'Notify caregiver if missed',
  `created_at`           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_reminders_elderly_time_status` (`elderly_id`, `scheduled_at`, `status`),
  KEY `idx_reminders_type` (`type`),
  CONSTRAINT `fk_reminders_elderly` FOREIGN KEY (`elderly_id`) REFERENCES `elderly_profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `notifications` (
  `id`                VARCHAR(36)   NOT NULL DEFAULT (UUID()),
  `elderly_id`        VARCHAR(36)   NULL,
  `recipient_user_id` VARCHAR(36)   NOT NULL,
  `type`              ENUM('DRUG_INTERACTION_ALERT','MEDICATION_REMINDER','MEDICATION_MISSED',
                           'VITAL_SIGN_ALERT','APPOINTMENT_REMINDER','SYSTEM_ALERT',
                           'CAREGIVER_MESSAGE','OVERDOSE_WARNING') NOT NULL,
  `channel`           ENUM('PUSH','SMS','EMAIL','IN_APP') NOT NULL DEFAULT 'IN_APP',
  `priority`          ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'MEDIUM',
  `title`             VARCHAR(255)  NOT NULL,
  `body`              TEXT          NOT NULL,
  `metadata`          JSON          NULL,
  `is_read`           TINYINT(1)    NOT NULL DEFAULT 0,
  `read_at`           DATETIME      NULL,
  `sent_at`           DATETIME      NULL,
  `fcm_token`         VARCHAR(500)  NULL,
  `created_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notif_elderly_read_time` (`elderly_id`, `is_read`, `created_at`),
  KEY `idx_notif_recipient` (`recipient_user_id`),
  KEY `idx_notif_type_priority` (`type`, `priority`),
  CONSTRAINT `fk_notif_elderly` FOREIGN KEY (`elderly_id`) REFERENCES `elderly_profiles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SEED: Drug catalog (sample data)
-- ============================================================

INSERT INTO `drugs` (`id`, `generic_name`, `brand_name`, `category`, `form`, `strength`, `rxnorm_code`, `atc_code`, `requires_prescription`, `is_active`) VALUES
  (UUID(), 'Aspirin',           'Aspirin Bayer',  'ANALGESIC',         'TABLET',  '81mg',    '1191',   'B01AC06', 0, 1),
  (UUID(), 'Aspirin',           'Aspirin Bayer',  'NSAID',             'TABLET',  '500mg',   '1191',   'N02BA01', 0, 1),
  (UUID(), 'Warfarin',          'Coumadin',       'ANTICOAGULANT',     'TABLET',  '5mg',     '11289',  'B01AA03', 1, 1),
  (UUID(), 'Metformin',         'Glucophage',     'ANTIDIABETIC',      'TABLET',  '500mg',   '6809',   'A10BA02', 1, 1),
  (UUID(), 'Metformin',         'Glucophage',     'ANTIDIABETIC',      'TABLET',  '1000mg',  '6809',   'A10BA02', 1, 1),
  (UUID(), 'Amlodipine',        'Norvasc',        'ANTIHYPERTENSIVE',  'TABLET',  '5mg',     '17767',  'C08CA01', 1, 1),
  (UUID(), 'Lisinopril',        'Zestril',        'ANTIHYPERTENSIVE',  'TABLET',  '10mg',    '29046',  'C09AA03', 1, 1),
  (UUID(), 'Atorvastatin',      'Lipitor',        'CARDIOVASCULAR',    'TABLET',  '20mg',    '83367',  'C10AA05', 1, 1),
  (UUID(), 'Omeprazole',        'Losec',          'OTHER',             'CAPSULE', '20mg',    '7646',   'A02BC01', 0, 1),
  (UUID(), 'Furosemide',        'Lasix',          'DIURETIC',          'TABLET',  '40mg',    '4603',   'C03CA01', 1, 1),
  (UUID(), 'Digoxin',           'Lanoxin',        'CARDIOVASCULAR',    'TABLET',  '0.25mg',  '3407',   'C01AA05', 1, 1),
  (UUID(), 'Paracetamol',       'Panadol',        'ANALGESIC',         'TABLET',  '500mg',   '161',    'N02BE01', 0, 1),
  (UUID(), 'Diazepam',          'Valium',         'SEDATIVE',          'TABLET',  '5mg',     '3322',   'N05BA01', 1, 1),
  (UUID(), 'Simvastatin',       'Zocor',          'CARDIOVASCULAR',    'TABLET',  '20mg',    '36567',  'C10AA01', 1, 1),
  (UUID(), 'Clopidogrel',       'Plavix',         'ANTICOAGULANT',     'TABLET',  '75mg',    '32968',  'B01AC04', 1, 1),
  (UUID(), 'Vitamin D3',        'Cholecalciferol','SUPPLEMENT',        'TABLET',  '1000IU',  '41953',  'A11CC05', 0, 1),
  (UUID(), 'Calcium Carbonate', 'Calci-Chew',     'SUPPLEMENT',        'TABLET',  '500mg',   '4193',   'A12AA04', 0, 1);

SET foreign_key_checks = 1;
