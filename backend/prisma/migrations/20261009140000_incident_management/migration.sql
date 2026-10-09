ALTER TABLE `Incident`
  ADD COLUMN `assignedToUserId` VARCHAR(191) NULL,
  ADD COLUMN `kind` ENUM('INCIDENT', 'NOTICE') NOT NULL DEFAULT 'INCIDENT',
  ADD COLUMN `priority` ENUM('NORMAL', 'HIGH', 'URGENT') NOT NULL DEFAULT 'NORMAL';

CREATE TABLE `IncidentComment` (
  `id` VARCHAR(191) NOT NULL,
  `incidentId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `message` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `IncidentComment_incidentId_createdAt_idx` (`incidentId`, `createdAt`),
  CONSTRAINT `IncidentComment_incidentId_fkey` FOREIGN KEY (`incidentId`) REFERENCES `Incident` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `IncidentComment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Incident`
  ADD INDEX `Incident_assignedToUserId_idx` (`assignedToUserId`),
  ADD CONSTRAINT `Incident_assignedToUserId_fkey` FOREIGN KEY (`assignedToUserId`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
