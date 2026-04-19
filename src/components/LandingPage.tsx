import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Brain, CalendarClock, TrendingUp, Send, ArrowRight, Flame, BarChart3, Sparkles, CalendarRange } from 'lucide-react';
import SparkLogo from './SparkLogo';

const TYPING_PHRASES = [
  '告诉火花你想做什么...',
  '帮我写一篇小红书爆款笔记',
  '分析一下最近哪些选题更火',
  '用我的品牌调性写一篇推文',
];

const QUICK_PROMPTS: Array<{
  icon: typeof Flame;
  label: string;
  prompt: string;
  /** 图标背景色（淡橘 / 淡蓝 / 淡紫 / 淡绿）让 4 个胶囊有视觉区分 */
  iconBg: string;
  iconColor: string;
}> = [
  {
    icon: Flame,
    label: '帮我制定本周小红书发布计划',
    prompt: '帮我制定本周小红书发布计划',
    iconBg: 'rgba(255, 107, 26, 0.12)',
    iconColor: '#FF6B1A',
  },
  {
    icon: BarChart3,
    label: '看看我上一篇内容的数据表现',
    prompt: '看看我上一篇内容的数据表现',
    iconBg: 'rgba(59, 130, 246, 0.12)',
    iconColor: '#3B82F6',
  },
  {
    icon: Sparkles,
    label: '根据我的品牌调性写一篇推文',
    prompt: '根据我的品牌调性写一篇推文',
    iconBg: 'rgba(168, 85, 247, 0.12)',
    iconColor: '#A855F7',
  },
  {
    icon: CalendarRange,
    label: '每天自动帮我生成一篇种草笔记',
    prompt: '每天自动帮我生成一篇种草笔记',
    iconBg: 'rgba(16, 185, 129, 0.12)',
    iconColor: '#10B981',
  },
];

const CAPABILITIES = [
  {
    icon: Brain,
    eyebrow: 'MEMORY',
    title: '品牌记忆',
    desc: '记住你的调性、风格、禁忌词，越用越懂你',
    /** 卡片悬停时高亮的指标 — 像 case study 的关键数据 */
    metric: '∞',
    metricLabel: '记忆容量',
  },
  {
    icon: CalendarClock,
    eyebrow: 'AUTOMATION',
    title: '自动排期',
    desc: '定时生成、审核、发布，全流程自动化',
    metric: '24/7',
    metricLabel: '不间断运转',
  },
  {
    icon: TrendingUp,
    eyebrow: 'INSIGHTS',
    title: '数据驱动',
    desc: '真实数据回流，AI 分析表现，持续优化内容',
    metric: '+38%',
    metricLabel: '平均互动提升',
  },
];

function useTypewriter(phrases: string[]) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [text, setText] = useState('');

  useEffect(() => {
    const phrase = phrases[phraseIndex];
    let charIndex = 0;
    setText('');

    const typeInterval = setInterval(() => {
      charIndex += 1;
      setText(phrase.slice(0, charIndex));
      if (charIndex >= phrase.length) {
        clearInterval(typeInterval);
      }
    }, 80);

    const totalTypeMs = phrase.length * 80;
    const holdTimeout = setTimeout(() => {
      setPhraseIndex((i) => (i + 1) % phrases.length);
    }, totalTypeMs + 2400);

    return () => {
      clearInterval(typeInterval);
      clearTimeout(holdTimeout);
    };
  }, [phraseIndex, phrases]);

  return text;
}

export default function LandingPage() {
  const navigate = useNavigate();
  const placeholder = useTypewriter(TYPING_PHRASES);

  const blob1Ref = useRef<HTMLDivElement>(null);
  const blob2Ref = useRef<HTMLDivElement>(null);
  const blob3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let rafId = 0;

    const onMove = (e: MouseEvent) => {
      // -1 ~ 1 范围，相对屏幕中心
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
    };

    const tick = () => {
      // 缓动跟随
      current.x += (target.x - current.x) * 0.06;
      current.y += (target.y - current.y) * 0.06;

      if (blob1Ref.current) {
        blob1Ref.current.style.transform = `translate3d(calc(-50% + ${current.x * 28}px), ${current.y * 22}px, 0)`;
      }
      if (blob2Ref.current) {
        blob2Ref.current.style.transform = `translate3d(${current.x * -40}px, ${current.y * -30}px, 0)`;
      }
      if (blob3Ref.current) {
        blob3Ref.current.style.transform = `translate3d(${current.x * 50}px, ${current.y * 36}px, 0)`;
      }
      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove);
    rafId = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  const goAuth = (prompt?: string) => {
    if (prompt) {
      try {
        sessionStorage.setItem('spark.pendingPrompt', prompt);
      } catch {
        /* ignore storage errors */
      }
    }
    navigate({ to: '/auth' });
  };

  return (
    <div className="relative min-h-screen bg-[#FAFAF8] flex flex-col overflow-hidden">
      {/* Background decorations */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage:
              'radial-gradient(ellipse at 50% 30%, black 30%, transparent 75%)',
            WebkitMaskImage:
              'radial-gradient(ellipse at 50% 30%, black 30%, transparent 75%)',
          }}
        />
        {/* Orange glow blobs with parallax */}
        <div
          ref={blob1Ref}
          className="absolute -top-40 left-1/2 w-[720px] h-[720px] rounded-full blur-3xl will-change-transform"
          style={{
            background:
              'radial-gradient(circle, rgba(255,165,110,0.32) 0%, rgba(255,165,110,0) 65%)',
            transform: 'translate3d(-50%, 0, 0)',
          }}
        />
        <div
          ref={blob2Ref}
          className="absolute top-1/3 -left-40 w-[520px] h-[520px] rounded-full blur-3xl will-change-transform"
          style={{
            background:
              'radial-gradient(circle, rgba(255,150,100,0.24) 0%, rgba(255,150,100,0) 70%)',
          }}
        />
        <div
          ref={blob3Ref}
          className="absolute bottom-0 -right-40 w-[560px] h-[560px] rounded-full blur-3xl will-change-transform"
          style={{
            background:
              'radial-gradient(circle, rgba(255,200,160,0.28) 0%, rgba(255,200,160,0) 70%)',
          }}
        />
      </div>

      <main className="relative flex-1 flex flex-col items-center px-6 pt-16 pb-12 sm:pt-24">
        <div className="w-full max-w-2xl flex flex-col items-center">
          {/* 1. Hero — 品牌化排版 */}
          <section
            className="flex flex-col items-center text-center opacity-0"
            style={{
              animation: 'spark-fade-in 0.6s ease-out forwards',
              animationDelay: '0ms',
            }}
          >
            {/* Eyebrow：极细的品牌副线 */}
            <div className="mb-5 inline-flex items-center gap-2 text-[11px] tracking-[0.32em] uppercase text-[#B8755A]">
              <span className="w-6 h-px bg-[#E8C4A8]" />
              <span>Spark · AI Marketing Studio</span>
              <span className="w-6 h-px bg-[#E8C4A8]" />
            </div>

            {/* Logo 与标题并列：左 logo + 右 wordmark */}
            <div className="flex items-center gap-4 sm:gap-5">
              <SparkLogo size={64} />
              <div className="relative">
                {/* 大字「火花」— 渐变填充 + 微描边 + 字距收紧 */}
                <h1
                  className="font-extrabold leading-[0.9] tracking-[-0.04em] select-none"
                  style={{
                    fontSize: 'clamp(64px, 11vw, 112px)',
                    background:
                      'linear-gradient(135deg, #FF8C42 0%, #FF6B1A 45%, #E04E00 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    filter: 'drop-shadow(0 6px 18px rgba(255, 107, 26, 0.18))',
                  }}
                >
                  火花
                </h1>
                {/* 标题下的小工业刻度线，呼应"Studio" tagging */}
                {/* Sin 波形数据条：模拟音波/增长曲线，从中线向上下生长 */}
                <div
                  className="absolute -bottom-4 left-0 right-0 flex items-end justify-between gap-[3px]"
                  style={{ height: '22px' }}
                  aria-hidden
                >
                  {Array.from({ length: 28 }).map((_, i) => {
                    // 双正弦叠加：主波 + 高频副波，做出有节奏的"数据感"
                    const t = i / 27;
                    const wave =
                      Math.sin(t * Math.PI * 2.4) * 0.7 +
                      Math.sin(t * Math.PI * 5.1 + 0.6) * 0.3;
                    // 归一化到 0.18 ~ 1.0，避免完全压扁
                    const h = 0.18 + ((wave + 1) / 2) * 0.82;
                    // 每 6 段一个橘色高亮，营造刻度节奏
                    const isAccent = i % 6 === 0;
                    return (
                      <span
                        key={i}
                        className="flex-1 rounded-full transition-all"
                        style={{
                          height: `${(h * 100).toFixed(1)}%`,
                          background: isAccent
                            ? 'linear-gradient(to top, #FF6B1A, #FF8C42)'
                            : 'rgba(255,107,26,0.28)',
                          opacity: isAccent ? 0.95 : 0.7,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Tagline：主副两行，主行有强调橘 */}
            <p className="mt-10 text-xl sm:text-2xl text-[#1F1F1F] font-semibold tracking-tight">
              你的新媒体 AI 员工，
              <span className="text-[#FF6B1A]">越用越懂你</span>
            </p>
            <p className="mt-3 text-[13px] sm:text-sm text-[#8A8580] tracking-wide">
              从选题 · 创作 · 排期 · 发布 · 复盘 — 全自动管理你的内容增长
            </p>
          </section>

          {/* 2. Fake input */}
          <section
            className="w-full mt-12 opacity-0"
            style={{
              animation: 'spark-fade-in 0.6s ease-out forwards',
              animationDelay: '150ms',
            }}
          >
            <button
              type="button"
              onClick={() => goAuth()}
              aria-label="开始对话"
              className="group w-full bg-white border border-[#EEEDEB] rounded-3xl flex items-center pl-5 pr-2 py-2 hover:border-[#FFCBA8] hover:shadow-md transition-all"
            >
              <span className="flex-1 text-left text-[15px] text-[#999] py-2 truncate">
                {placeholder}
                <span
                  className="inline-block w-[2px] h-[16px] align-middle ml-0.5 bg-[#FF6B1A]"
                  style={{ animation: 'badge-ping 1s steps(2, end) infinite' }}
                />
              </span>
              <span
                className="ml-2 w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 transition-transform group-hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #FF8C42, #FF6B1A)' }}
              >
                <Send size={16} />
              </span>
            </button>
          </section>

          {/* 3. Quick prompts — 品牌化胶囊：彩色图标徽章 + hover 浮出箭头 */}
          <section
            className="w-full mt-7 flex flex-wrap justify-center gap-2.5 opacity-0"
            style={{
              animation: 'spark-fade-in 0.6s ease-out forwards',
              animationDelay: '300ms',
            }}
          >
            {QUICK_PROMPTS.map(({ icon: Icon, label, prompt, iconBg, iconColor }) => (
              <button
                key={prompt}
                type="button"
                onClick={() => goAuth(prompt)}
                className="group relative flex items-center gap-2 pl-2 pr-4 py-2 rounded-full bg-white border border-[#EEEDEB] text-[13px] text-[#3F3A35] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-[#FFCBA8] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                {/* 彩色图标徽章 */}
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                  style={{ background: iconBg }}
                >
                  <Icon size={14} style={{ color: iconColor }} strokeWidth={2.2} />
                </span>
                <span className="transition-colors group-hover:text-[#FF6B1A]">{label}</span>
                {/* hover 时浮出的 → 箭头：默认隐藏（宽度 0 + 透明），hover 时滑入 */}
                <span
                  className="overflow-hidden inline-flex items-center text-[#FF6B1A] opacity-0 max-w-0 -ml-1 group-hover:opacity-100 group-hover:max-w-[20px] group-hover:ml-0 transition-all duration-200"
                  aria-hidden
                >
                  <ArrowRight size={14} strokeWidth={2.4} />
                </span>
              </button>
            ))}
          </section>

          {/* 4. Capabilities — 作品集 case study 风格三卡 */}
          <section
            className="w-full mt-20 grid grid-cols-1 sm:grid-cols-3 gap-5"
          >
            {CAPABILITIES.map(({ icon: Icon, eyebrow, title, desc, metric, metricLabel }, idx) => (
              <article
                key={title}
                className="group relative bg-white border border-[#EEEDEB] rounded-2xl pl-6 pr-5 py-6 hover:border-[#FFCBA8] hover:shadow-[0_12px_32px_-12px_rgba(255,107,26,0.25)] hover:-translate-y-1 transition-[border-color,box-shadow,transform] duration-300 overflow-hidden opacity-0"
                style={{
                  animation: 'spark-slide-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards',
                  animationDelay: `${450 + idx * 100}ms`,
                }}
              >
                {/* 左侧竖向橘色色块 — 默认细线，hover 时变粗加深 */}
                <span
                  aria-hidden
                  className="absolute left-0 top-5 bottom-5 w-[3px] rounded-r-full transition-all duration-300 group-hover:w-[5px] group-hover:top-3 group-hover:bottom-3"
                  style={{
                    background: 'linear-gradient(to bottom, #FF8C42, #FF6B1A 60%, #E04E00)',
                  }}
                />

                {/* 顶部行：编号 + eyebrow + 图标 */}
                <header className="flex items-start justify-between mb-5">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[26px] leading-none font-bold text-[#FF6B1A] tracking-tight tabular-nums">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[10px] tracking-[0.28em] text-[#B8755A] font-medium">
                      {eyebrow}
                    </span>
                  </div>
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-4deg]"
                    style={{ background: 'rgba(255, 107, 26, 0.08)' }}
                  >
                    <Icon size={17} className="text-[#FF6B1A]" strokeWidth={2.1} />
                  </div>
                </header>

                {/* 标题：大号、紧凑字距 */}
                <h3 className="text-[22px] font-bold text-[#1F1F1F] tracking-tight leading-tight mb-2">
                  {title}
                </h3>
                <p className="text-[13px] text-[#8A8580] leading-relaxed mb-5">{desc}</p>

                {/* 底部分隔线 + key metric — 像 case study 的成绩单 */}
                <div className="pt-4 border-t border-dashed border-[#F0EFED] flex items-baseline justify-between">
                  <span className="text-[11px] text-[#B8B5B0] tracking-wide">{metricLabel}</span>
                  <span className="text-[18px] font-bold text-[#1F1F1F] tabular-nums tracking-tight">
                    {metric}
                  </span>
                </div>
              </article>
            ))}
          </section>

          {/* 5. CTA */}
          <section
            className="mt-12 opacity-0"
            style={{
              animation: 'spark-fade-in 0.6s ease-out forwards',
              animationDelay: '600ms',
            }}
          >
            <button
              type="button"
              onClick={() => goAuth()}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-white font-medium spark-shadow hover:opacity-95 hover:scale-[1.02] transition-all"
              style={{ background: 'linear-gradient(135deg, #FF8C42, #FF6B1A)' }}
            >
              立即开始
              <ArrowRight size={16} />
            </button>
          </section>
        </div>
      </main>

      <footer className="relative border-t border-[#EEEDEB] mt-16 bg-white/40 overflow-hidden">
        {/* 超大背景描边水印 */}
        <div
          aria-hidden
          className="pointer-events-none select-none absolute -bottom-8 -right-4 md:-bottom-14 md:-right-8 leading-none font-black tracking-tighter"
          style={{
            fontSize: 'clamp(180px, 26vw, 360px)',
            color: 'transparent',
            WebkitTextStroke: '1.5px rgba(255, 107, 26, 0.18)',
            opacity: 0.35,
          }}
        >
          SPARK
        </div>

        <div className="relative max-w-[1080px] mx-auto px-6 pt-14 pb-10">
          {/* Top: logo + 3 link columns */}
          <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10 md:gap-8">
            {/* Brand */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <SparkLogo size={28} />
                <span className="text-[17px] font-bold tracking-tight text-[#1A1816]">
                  火花 <span className="text-[#FF6B1A]">Spark</span>
                </span>
              </div>
              <p className="text-[12.5px] leading-[1.7] text-[#8A8680] max-w-[260px]">
                AI 驱动的品牌营销引擎，为创作者与品牌打造可持续的内容增长系统。
              </p>
              <div className="flex items-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-[#8A8680] bg-[#F5F3EF] border border-[#EEEDEB] rounded-full px-2.5 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                  All systems operational
                </span>
              </div>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-[#B8B5B0] mb-4">
                产品
              </h4>
              <ul className="space-y-2.5">
                {['对话创作', '智能排期', '数据复盘', '品牌记忆'].map((item) => (
                  <li key={item}>
                    <a href="#" className="group inline-flex items-center gap-1.5 text-[13px] text-[#3A3733] hover:text-[#FF6B1A] transition-colors">
                      <span>{item}</span>
                      <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-[#B8B5B0] mb-4">
                资源
              </h4>
              <ul className="space-y-2.5">
                {['更新日志', '使用指南', '案例研究', '联系我们'].map((item) => (
                  <li key={item}>
                    <a href="#" className="group inline-flex items-center gap-1.5 text-[13px] text-[#3A3733] hover:text-[#FF6B1A] transition-colors">
                      <span>{item}</span>
                      <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-[#B8B5B0] mb-4">
                法务
              </h4>
              <ul className="space-y-2.5">
                {['服务条款', '隐私政策', 'Cookie 设置', '数据安全'].map((item) => (
                  <li key={item}>
                    <a href="#" className="group inline-flex items-center gap-1.5 text-[13px] text-[#3A3733] hover:text-[#FF6B1A] transition-colors">
                      <span>{item}</span>
                      <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Divider with accent */}
          <div className="relative mt-12 mb-6">
            <div className="h-px bg-[#EEEDEB]" />
            <div className="absolute left-0 top-0 h-px w-16" style={{ background: 'linear-gradient(to right, #FF6B1A, transparent)' }} />
          </div>

          {/* Bottom: copyright */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-[11.5px] text-[#B8B5B0] tracking-wide">
              © 2026 火花 Spark Studio · Crafted for brand storytellers
            </p>
            <p className="text-[10.5px] text-[#C8C5C0] tracking-[0.12em] uppercase">
              Made with <span className="text-[#FF6B1A]">●</span> in Shenzhen
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
