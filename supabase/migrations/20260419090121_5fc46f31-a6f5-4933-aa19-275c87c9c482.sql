-- Multi-conversation support
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NULL,
  device_id text NULL,
  title text NOT NULL DEFAULT '新对话',
  pinned boolean NOT NULL DEFAULT false,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_user ON public.conversations(user_id, last_message_at DESC);
CREATE INDEX idx_conversations_device ON public.conversations(device_id, last_message_at DESC);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversations_select_own ON public.conversations FOR SELECT
  USING (
    (user_id = auth.uid())
    OR (user_id IS NULL AND device_id IS NOT NULL
        AND device_id = ((current_setting('request.headers', true))::json ->> 'x-device-id'))
  );

CREATE POLICY conversations_insert_own ON public.conversations FOR INSERT
  WITH CHECK (
    (user_id = auth.uid())
    OR (user_id IS NULL AND device_id IS NOT NULL
        AND device_id = ((current_setting('request.headers', true))::json ->> 'x-device-id'))
  );

CREATE POLICY conversations_update_own ON public.conversations FOR UPDATE
  USING (
    (user_id = auth.uid())
    OR (user_id IS NULL AND device_id IS NOT NULL
        AND device_id = ((current_setting('request.headers', true))::json ->> 'x-device-id'))
  );

CREATE POLICY conversations_delete_own ON public.conversations FOR DELETE
  USING (
    (user_id = auth.uid())
    OR (user_id IS NULL AND device_id IS NOT NULL
        AND device_id = ((current_setting('request.headers', true))::json ->> 'x-device-id'))
  );

CREATE POLICY conversations_service_role_all ON public.conversations FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- Messages within a conversation. Stores the full ChatMessage payload as jsonb
-- so we don't have to map every UI field (choices/options/contentItem/etc).
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NULL,
  device_id text NULL,
  role text NOT NULL,
  content text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_conv ON public.chat_messages(conversation_id, created_at);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_messages_select_own ON public.chat_messages FOR SELECT
  USING (
    (user_id = auth.uid())
    OR (user_id IS NULL AND device_id IS NOT NULL
        AND device_id = ((current_setting('request.headers', true))::json ->> 'x-device-id'))
  );

CREATE POLICY chat_messages_insert_own ON public.chat_messages FOR INSERT
  WITH CHECK (
    (user_id = auth.uid())
    OR (user_id IS NULL AND device_id IS NOT NULL
        AND device_id = ((current_setting('request.headers', true))::json ->> 'x-device-id'))
  );

CREATE POLICY chat_messages_update_own ON public.chat_messages FOR UPDATE
  USING (
    (user_id = auth.uid())
    OR (user_id IS NULL AND device_id IS NOT NULL
        AND device_id = ((current_setting('request.headers', true))::json ->> 'x-device-id'))
  );

CREATE POLICY chat_messages_delete_own ON public.chat_messages FOR DELETE
  USING (
    (user_id = auth.uid())
    OR (user_id IS NULL AND device_id IS NOT NULL
        AND device_id = ((current_setting('request.headers', true))::json ->> 'x-device-id'))
  );

CREATE POLICY chat_messages_service_role_all ON public.chat_messages FOR ALL
  TO service_role USING (true) WITH CHECK (true);
