CREATE TABLE "mcp_request_quota" (
	"user_id" text PRIMARY KEY NOT NULL,
	"window_start" bigint NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mcp_request_quota" ADD CONSTRAINT "mcp_request_quota_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;