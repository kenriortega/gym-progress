CREATE TABLE "body_weights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"weight" numeric(5, 2) NOT NULL,
	"measured_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "body_weights_weight_range" CHECK ("body_weights"."weight" between 20 and 500)
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "goal_weight" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "body_weights" ADD CONSTRAINT "body_weights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "body_weights_user_day_unique" ON "body_weights" USING btree ("user_id","measured_on");--> statement-breakpoint
CREATE INDEX "body_weights_user_day_idx" ON "body_weights" USING btree ("user_id","measured_on");