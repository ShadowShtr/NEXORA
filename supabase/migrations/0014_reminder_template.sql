-- NEX-104: "Personalizar template simples" — null means "use the built-in default"
-- (DEFAULT_REMINDER_TEMPLATE, src/features/reminders/domain/template.ts), same
-- null-means-off pattern as no_show_limit (0011_no_show_policy.sql). The length check
-- mirrors REMINDER_TEMPLATE_MAX_LENGTH — this is free text, not a URL, but a very long
-- template composed with a very long client name could otherwise produce a wa.me URL
-- past what some clients handle gracefully (this task's own "URL length" test
-- requirement), so bounding the template here bounds that risk at the source.
alter table public.business_settings
  add column reminder_message_template text check (
    reminder_message_template is null or char_length(reminder_message_template) <= 500
  );
