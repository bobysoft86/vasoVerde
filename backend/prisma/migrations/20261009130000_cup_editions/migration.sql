ALTER TABLE `CupType`
  ADD COLUMN `ownerEventId` VARCHAR(191) NULL,
  ADD COLUMN `baseTypeId` VARCHAR(191) NULL;
CREATE INDEX `CupType_ownerEventId_idx` ON `CupType` (`ownerEventId`);
CREATE INDEX `CupType_baseTypeId_idx` ON `CupType` (`baseTypeId`);
ALTER TABLE `CupType` ADD CONSTRAINT `CupType_ownerEventId_fkey` FOREIGN KEY (`ownerEventId`) REFERENCES `Event` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CupType` ADD CONSTRAINT `CupType_baseTypeId_fkey` FOREIGN KEY (`baseTypeId`) REFERENCES `CupType` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
