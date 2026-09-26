INSERT INTO `Location` (`id`, `companyId`, `eventId`, `boothId`, `type`, `name`, `code`, `active`, `createdAt`, `updatedAt`)
SELECT UUID(), e.`companyId`, b.`eventId`, b.`id`, 'BOOTH', b.`name`, CONCAT('BOOTH-', b.`eventId`, '-', b.`code`), b.`active`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `Booth` b
JOIN `Event` e ON e.`id` = b.`eventId`
LEFT JOIN `Location` l ON l.`boothId` = b.`id`
WHERE l.`id` IS NULL;
