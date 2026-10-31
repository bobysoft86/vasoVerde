ALTER TABLE `User` ADD COLUMN `mustChangePassword` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `StockThreshold` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `eventId` VARCHAR(191) NOT NULL,
  `locationId` VARCHAR(191) NOT NULL,
  `cupTypeId` VARCHAR(191) NOT NULL,
  `minimum` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `StockThreshold_locationId_cupTypeId_key` (`locationId`, `cupTypeId`),
  INDEX `StockThreshold_companyId_eventId_idx` (`companyId`, `eventId`),
  CONSTRAINT `StockThreshold_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `StockThreshold_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `StockThreshold_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `Location` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `StockThreshold_cupTypeId_fkey` FOREIGN KEY (`cupTypeId`) REFERENCES `CupType` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StockCount` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `eventId` VARCHAR(191) NOT NULL,
  `locationId` VARCHAR(191) NOT NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `StockCount_companyId_eventId_locationId_createdAt_idx` (`companyId`, `eventId`, `locationId`, `createdAt`),
  CONSTRAINT `StockCount_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `StockCount_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `StockCount_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `Location` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `StockCount_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StockCountLine` (
  `id` VARCHAR(191) NOT NULL,
  `stockCountId` VARCHAR(191) NOT NULL,
  `cupTypeId` VARCHAR(191) NOT NULL,
  `condition` ENUM('CLEAN', 'DIRTY', 'DAMAGED', 'LOST') NOT NULL,
  `expected` INTEGER NOT NULL,
  `counted` INTEGER NOT NULL,
  `difference` INTEGER NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `StockCountLine_stockCountId_cupTypeId_condition_key` (`stockCountId`, `cupTypeId`, `condition`),
  CONSTRAINT `StockCountLine_stockCountId_fkey` FOREIGN KEY (`stockCountId`) REFERENCES `StockCount` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `StockCountLine_cupTypeId_fkey` FOREIGN KEY (`cupTypeId`) REFERENCES `CupType` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
