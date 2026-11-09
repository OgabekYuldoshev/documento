-- DB-level guarantee: a superadmin can never be deleted, demoted, or banned.
CREATE TRIGGER `protect_superadmin_delete`
BEFORE DELETE ON `user`
WHEN OLD.role = 'superadmin'
BEGIN
  SELECT RAISE(ABORT, 'superadmin cannot be deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `protect_superadmin_update`
BEFORE UPDATE ON `user`
WHEN OLD.role = 'superadmin' AND (NEW.role <> 'superadmin' OR NEW.banned = 1)
BEGIN
  SELECT RAISE(ABORT, 'superadmin cannot be demoted or banned');
END;
