import { supabase } from '@/integrations/supabase/client';
import type { ScheduleConfig, Platform, ContentItem } from '../types/spark';
import { generateArticle } from './ai-stream';
import { saveReviewItem } from './review-persistence';

const DEVICE_KEY = 'spark-device-id';
const LEGACY_CONFIG_KEY = 'spark-auto-schedule';
const LEGACY_LOG_KEY = 'spark-auto-schedule-log';

export interface ScheduleLogEntry {
  id: string;
  topic: string;
  platform: Platform;
  status: 'success' | 'error' | 'pending';
  contentId?: string;
  error?: string;
  timestamp: string;
}

const DEFAULT_CONFIG: ScheduleConfig = {
  enabled: false,
  frequency: 'daily',
  daysOfWeek: [1, 3, 5],
  platforms: ['xiaohongshu'],
  topics: [],
  style: '',
  postsPerDay: 1,
  scheduledTimes: ['09:00'],
};

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function rowToConfig(row: Record<string, unknown>): ScheduleConfig {
  return {
    enabled: !!row.enabled,
    frequency: (row.frequency as ScheduleConfig['frequency']) || 'daily',
    daysOfWeek: (row.days_of_week as number[]) || [1, 3, 5],
    platforms: (row.platforms as Platform[]) || ['xiaohongshu'],
    topics: (row.topics as string[]) || [],
    style: (row.style as string) || '',
    postsPerDay: (row.posts_per_day as number) || 1,
    scheduledTimes: (row.scheduled_times as string[]) || ['09:00'],
  };
}

function rowToLog(row: Record<string, unknown>): ScheduleLogEntry {
  return {
    id: row.id as string,
    topic: (row.log_topic as string) || '',
    platform: (row.log_platform as Platform) || 'xiaohongshu',
    status: (row.log_status as ScheduleLogEntry['status']) || 'pending',
    contentId: (row.log_content_id as string) || undefined,
    error: (row.log_error as string) || undefined,
    timestamp: (row.log_timestamp as string) || new Date().toISOString(),
  };
}

/* ===================== CONFIG ===================== */

export async function loadScheduleConfig(): Promise<ScheduleConfig> {
  const deviceId = getDeviceId();
  try {
    const { data, error } = await supabase
      .from('schedule_tasks')
      .select('*')
      .eq('device_id', deviceId)
      .eq('kind', 'config')
      .maybeSingle();

    if (error) throw error;
    if (data) return rowToConfig(data as unknown as Record<string, unknown>);

    // Legacy migration from localStorage (one-time)
    const legacy = localStorage.getItem(LEGACY_CONFIG_KEY);
    if (legacy) {
      try {
        const cfg = { ...DEFAULT_CONFIG, ...JSON.parse(legacy) } as ScheduleConfig;
        await saveScheduleConfig(cfg);
        localStorage.removeItem(LEGACY_CONFIG_KEY);
        return cfg;
      } catch {}
    }
  } catch (e) {
    console.warn('[schedule] loadConfig failed, fallback to local default', e);
  }
  return DEFAULT_CONFIG;
}

export async function saveScheduleConfig(config: ScheduleConfig): Promise<void> {
  const deviceId = getDeviceId();
  const payload = {
    device_id: deviceId,
    kind: 'config',
    enabled: config.enabled,
    frequency: config.frequency,
    days_of_week: config.daysOfWeek,
    platforms: config.platforms,
    topics: config.topics,
    style: config.style,
    posts_per_day: config.postsPerDay,
    scheduled_times: config.scheduledTimes || ['09:00'],
  };

  // Upsert by (device_id, kind='config') — unique index ensures single row
  const { data: existing } = await supabase
    .from('schedule_tasks')
    .select('id')
    .eq('device_id', deviceId)
    .eq('kind', 'config')
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('schedule_tasks')
      .update(payload)
      .eq('id', (existing as { id: string }).id);
    if (error) console.warn('[schedule] update config failed', error);
  } else {
    const { error } = await supabase.from('schedule_tasks').insert(payload);
    if (error) console.warn('[schedule] insert config failed', error);
  }
}

/* ===================== LOGS ===================== */

export async function loadScheduleLogs(limit = 50): Promise<ScheduleLogEntry[]> {
  const deviceId = getDeviceId();
  try {
    const { data, error } = await supabase
      .from('schedule_tasks')
      .select('*')
      .eq('device_id', deviceId)
      .eq('kind', 'log')
      .order('log_timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;
    const rows = (data || []) as unknown as Record<string, unknown>[];
    if (rows.length > 0) return rows.map(rowToLog);

    // Legacy migration
    const legacy = localStorage.getItem(LEGACY_LOG_KEY);
    if (legacy) {
      try {
        const logs = JSON.parse(legacy) as ScheduleLogEntry[];
        for (const l of logs) await insertScheduleLog(l);
        localStorage.removeItem(LEGACY_LOG_KEY);
        return logs;
      } catch {}
    }
  } catch (e) {
    console.warn('[schedule] loadLogs failed', e);
  }
  return [];
}

export async function insertScheduleLog(log: ScheduleLogEntry): Promise<void> {
  const deviceId = getDeviceId();
  const { error } = await supabase.from('schedule_tasks').insert({
    device_id: deviceId,
    kind: 'log',
    log_topic: log.topic,
    log_platform: log.platform,
    log_status: log.status,
    log_content_id: log.contentId,
    log_error: log.error,
    log_timestamp: log.timestamp,
  });
  if (error) console.warn('[schedule] insert log failed', error);
}

export async function updateScheduleLog(log: ScheduleLogEntry): Promise<void> {
  const deviceId = getDeviceId();
  // Match by topic + platform + timestamp (no client-side stable PK)
  const { error } = await supabase
    .from('schedule_tasks')
    .update({
      log_status: log.status,
      log_content_id: log.contentId,
      log_error: log.error,
    })
    .eq('device_id', deviceId)
    .eq('kind', 'log')
    .eq('log_topic', log.topic)
    .eq('log_platform', log.platform)
    .eq('log_timestamp', log.timestamp);
  if (error) console.warn('[schedule] update log failed', error);
}

export async function clearScheduleLogs(): Promise<void> {
  const deviceId = getDeviceId();
  const { error } = await supabase
    .from('schedule_tasks')
    .delete()
    .eq('device_id', deviceId)
    .eq('kind', 'log');
  if (error) console.warn('[schedule] clear logs failed', error);
}

/* ===================== REALTIME ===================== */

export function subscribeScheduleChanges(
  onConfigChange: (cfg: ScheduleConfig) => void,
  onLogChange: () => void,
) {
  const deviceId = getDeviceId();
  const channel = supabase
    .channel(`schedule_tasks_${deviceId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'schedule_tasks',
        filter: `device_id=eq.${deviceId}`,
      },
      (payload) => {
        const row = (payload.new || payload.old) as Record<string, unknown> | undefined;
        if (!row) return;
        if (row.kind === 'config' && payload.new) {
          onConfigChange(rowToConfig(payload.new as Record<string, unknown>));
        } else if (row.kind === 'log') {
          onLogChange();
        }
      },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/* ===================== TASK EXECUTION ===================== */

export interface ExecuteTaskInput {
  topic: string;
  platform: Platform;
  style?: string;
  brandContext?: string;
  taskName?: string;
}

/**
 * Generate one piece of content via AI and push it into the review queue.
 * Used by both the scheduled trigger and the manual "Run Now" test button.
 */
export async function executeScheduledTask(
  input: ExecuteTaskInput,
): Promise<{ success: boolean; contentId?: string; error?: string }> {
  const timestamp = new Date().toISOString();
  const taskName = input.taskName || `定时任务·${input.topic}`;

  // Pre-write a pending log entry
  const pendingLog = {
    id: '',
    topic: input.topic,
    platform: input.platform,
    status: 'pending' as const,
    timestamp,
  };
  await insertScheduleLog(pendingLog);

  try {
    const article = await generateArticle({
      topic: input.topic,
      platform: input.platform,
      style: input.style,
      brandContext: input.brandContext,
    });

    const contentId = `sched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const item: ContentItem = {
      id: contentId,
      title: article.title,
      content: article.content,
      cta: article.cta,
      tags: article.tags,
      platform: input.platform,
      status: 'reviewing',
      autoGenerated: true,
      createdAt: now,
      updatedAt: now,
    };

    await saveReviewItem(item, {
      source: 'schedule',
      taskName,
      topic: input.topic,
      triggeredAt: timestamp,
    });

    await updateScheduleLog({
      ...pendingLog,
      status: 'success',
      contentId,
    });

    return { success: true, contentId };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await updateScheduleLog({
      ...pendingLog,
      status: 'error',
      error: message,
    });
    return { success: false, error: message };
  }
}
