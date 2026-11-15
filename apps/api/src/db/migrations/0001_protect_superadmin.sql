-- DB-level guarantee: a superadmin can never be deleted, demoted, or banned.
CREATE FUNCTION protect_superadmin_delete() RETURNS trigger AS $$
BEGIN
  IF OLD.role = 'superadmin' THEN
    RAISE EXCEPTION 'superadmin cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER protect_superadmin_delete
BEFORE DELETE ON "user"
FOR EACH ROW EXECUTE FUNCTION protect_superadmin_delete();
--> statement-breakpoint
CREATE FUNCTION protect_superadmin_update() RETURNS trigger AS $$
BEGIN
  IF OLD.role = 'superadmin' AND (NEW.role <> 'superadmin' OR NEW.banned) THEN
    RAISE EXCEPTION 'superadmin cannot be demoted or banned';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER protect_superadmin_update
BEFORE UPDATE ON "user"
FOR EACH ROW EXECUTE FUNCTION protect_superadmin_update();
