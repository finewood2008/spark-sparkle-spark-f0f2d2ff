-- 登录失败记录表
CREATE TABLE public.login_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  ip_address text NOT NULL,
  attempted_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 启用 RLS（默认拒绝所有访问，仅 service role 可读写）
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- 加速按邮箱 + 时间窗口查询
CREATE INDEX idx_login_attempts_email_time
  ON public.login_attempts (email, attempted_at DESC);

-- 加速按 IP + 时间窗口查询
CREATE INDEX idx_login_attempts_ip_time
  ON public.login_attempts (ip_address, attempted_at DESC);

-- 自动清理函数：删除 30 天前的记录
CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.login_attempts
  WHERE attempted_at < now() - interval '30 days';
END;
$$;