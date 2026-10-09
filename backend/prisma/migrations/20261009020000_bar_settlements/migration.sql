ALTER TABLE `StockMovement`
  ADD COLUMN `chargeable` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `chargeAmount` DECIMAL(12,2) NULL;

ALTER TABLE `CashMovement`
  ADD COLUMN `barSettlementId` VARCHAR(191) NULL;

CREATE TABLE `BarSettlement` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `eventId` VARCHAR(191) NOT NULL,
  `locationId` VARCHAR(191) NOT NULL,
  `createdByUserId` VARCHAR(191) NOT NULL,
  `status` ENUM('CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'CONFIRMED',
  `totalDelivered` INTEGER NOT NULL,
  `totalCollected` INTEGER NOT NULL,
  `prepaidAmount` DECIMAL(12,2) NOT NULL,
  `missingAmount` DECIMAL(12,2) NOT NULL,
  `balanceAmount` DECIMAL(12,2) NOT NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `confirmedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `BarSettlement_id_key`(`id`),
  INDEX `BarSettlement_companyId_eventId_locationId_status_idx`(`companyId`, `eventId`, `locationId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BarSettlementLine` (
  `id` VARCHAR(191) NOT NULL,
  `settlementId` VARCHAR(191) NOT NULL,
  `cupTypeId` VARCHAR(191) NOT NULL,
  `delivered` INTEGER NOT NULL,
  `collected` INTEGER NOT NULL,
  `difference` INTEGER NOT NULL,
  `unitPrice` DECIMAL(10,2) NOT NULL,
  `missingAmount` DECIMAL(12,2) NOT NULL,
  UNIQUE INDEX `BarSettlementLine_id_key`(`id`),
  UNIQUE INDEX `BarSettlementLine_settlementId_cupTypeId_key`(`settlementId`, `cupTypeId`),
  INDEX `BarSettlementLine_cupTypeId_idx`(`cupTypeId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CashMovement` ADD CONSTRAINT `CashMovement_barSettlementId_key` UNIQUE (`barSettlementId`);
ALTER TABLE `CashMovement` ADD CONSTRAINT `CashMovement_barSettlementId_fkey` FOREIGN KEY (`barSettlementId`) REFERENCES `BarSettlement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `BarSettlement` ADD CONSTRAINT `BarSettlement_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `BarSettlement` ADD CONSTRAINT `BarSettlement_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `BarSettlement` ADD CONSTRAINT `BarSettlement_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `BarSettlement` ADD CONSTRAINT `BarSettlement_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `BarSettlementLine` ADD CONSTRAINT `BarSettlementLine_settlementId_fkey` FOREIGN KEY (`settlementId`) REFERENCES `BarSettlement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `BarSettlementLine` ADD CONSTRAINT `BarSettlementLine_cupTypeId_fkey` FOREIGN KEY (`cupTypeId`) REFERENCES `CupType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
