-- Custom migration: drizzle-orm's mysql-core does not expose a FULLTEXT index
-- builder, so the search index is added by hand (implementation plan §3/§7).
--
-- Requires innodb_ft_min_token_size=2 (see docker/mysql/my.cnf) to be set
-- before this index is built, otherwise 2-character searches like "G2"
-- silently match nothing.
CREATE FULLTEXT INDEX `idx_search` ON `submissions` (`name`, `company`, `testimonial_text`, `email`);