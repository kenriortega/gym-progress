CREATE TABLE "plan_reschedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_reschedules_forward" CHECK ("plan_reschedules"."to_date" <> "plan_reschedules"."from_date")
);
--> statement-breakpoint
ALTER TABLE "plan_reschedules" ADD CONSTRAINT "plan_reschedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_reschedules" ADD CONSTRAINT "plan_reschedules_plan_id_training_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_reschedules_plan_from_unique" ON "plan_reschedules" USING btree ("plan_id","from_date");--> statement-breakpoint
CREATE INDEX "plan_reschedules_user_to_idx" ON "plan_reschedules" USING btree ("user_id","to_date");