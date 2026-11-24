CREATE TABLE "kommunal_cache" (
	"ags" text PRIMARY KEY NOT NULL,
	"daten" jsonb NOT NULL,
	"abgerufen_am" timestamp with time zone NOT NULL
);
