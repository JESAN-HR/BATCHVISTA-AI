CREATE TABLE production_batch (
 id TEXT PRIMARY KEY,
 organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
 product_id TEXT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
 code TEXT NOT NULL, manufactured TEXT NOT NULL, expiry TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','CLOSED')),
 created_at TEXT NOT NULL,
 UNIQUE(product_id,code)
);
CREATE TABLE account (
 user_id TEXT PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
 username TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL,
 permission TEXT NOT NULL CHECK(permission IN ('admin','reviewer','inspector'))
);
CREATE TABLE login_attempt (username TEXT PRIMARY KEY, failures INTEGER NOT NULL, retry_at INTEGER NOT NULL);
INSERT INTO production_batch
 SELECT 'legacy-'||p.id,p.organization_id,p.id,json_extract(s.payload,'$.batch'),
 coalesce(json_extract(s.payload,'$.manufactured'),''),coalesce(json_extract(s.payload,'$.expiry'),''),'OPEN',p.created_at
 FROM product p JOIN product_specification s ON s.product_id=p.id;
INSERT INTO migration VALUES(2,datetime('now'));
