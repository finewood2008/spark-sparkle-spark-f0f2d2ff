import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Brain, CalendarClock, TrendingUp, Send, ArrowRight } from 'lucide-react';

const TYPING_PHRASES = [
  '告诉火花你想做什么...',
  '帮我写一篇小红书爆款笔记',
  '分析一下最近哪些选题更火',
  '用我的品牌调性写一篇推文',
];

const QUICK_PROMPTS = [
  '🔥 帮我制定本周小红书发布计划',
  '📊 看看我上一篇内容的数据表现',
  '✨ 根据我的品牌调性写一篇推文',
  '📅 每天自动帮我生成一篇种草笔记',
];

const CAPABILITIES = [
  {
    icon: Brain,
    title: '品牌记忆',
    desc: '记住你的调性、风格、禁忌词，越用越懂你',
  },
  {
    icon: CalendarClock,
    title: '自动排期',
    desc: '定时生成、审核、发布，全流程自动化',
  },
  {
    icon: TrendingUp,
    title: '数据驱动',
    desc: '真实数据回流，AI 分析表现，持续优化内容',
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

  const goAuth = () => navigate({ to: '/auth' });

  return (
    <div className="relative min-h-screen bg-[#FAFAF8] flex flex-col overflow-hidden">
      {/* Background decorations */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage:
              'radial-gradient(ellipse at 50% 30%, black 40%, transparent 75%)',
            WebkitMaskImage:
              'radial-gradient(ellipse at 50% 30%, black 40%, transparent 75%)',
          }}
        />
        {/* Orange glow blobs with parallax */}
        <div
          ref={blob1Ref}
          className="absolute -top-32 left-1/2 w-[720px] h-[720px] rounded-full blur-3xl opacity-40 will-change-transform"
          style={{
            background:
              'radial-gradient(circle, rgba(255,140,66,0.35) 0%, rgba(255,140,66,0) 65%)',
            transform: 'translate3d(-50%, 0, 0)',
            transition: 'transform 0.1s linear',
          }}
        />
        <div
          ref={blob2Ref}
          className="absolute top-1/3 -left-40 w-[480px] h-[480px] rounded-full blur-3xl opacity-30 will-change-transform"
          style={{
            background:
              'radial-gradient(circle, rgba(255,107,26,0.25) 0%, rgba(255,107,26,0) 70%)',
          }}
        />
        <div
          ref={blob3Ref}
          className="absolute bottom-0 -right-32 w-[520px] h-[520px] rounded-full blur-3xl opacity-25 will-change-transform"
          style={{
            background:
              'radial-gradient(circle, rgba(255,180,120,0.3) 0%, rgba(255,180,120,0) 70%)',
          }}
        />
      </div>

      <main className="relative flex-1 flex flex-col items-center px-6 pt-16 pb-12 sm:pt-24">
        <div className="w-full max-w-2xl flex flex-col items-center">
          {/* 1. Hero */}
          <section
            className="flex flex-col items-center text-center opacity-0"
            style={{
              animation: 'spark-fade-in 0.6s ease-out forwards',
              animationDelay: '0ms',
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 spark-shadow"
              style={{ background: 'linear-gradient(135deg, #FF8C42, #FF6B1A)' }}
            >
              <span className="text-3xl">✨</span>
            </div>
            <h1 className="text-5xl sm:text-6xl font-bold text-[#1F1F1F] tracking-tight">
              火花
            </h1>
            <p className="mt-4 text-lg sm:text-xl text-[#444] font-medium">
              你的新媒体 AI 员工，越用越懂你
            </p>
            <p className="mt-2 text-sm text-[#999]">
              从选题到发布，全自动管理你的内容增长
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
              onClick={goAuth}
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

          {/* 3. Quick prompts */}
          <section
            className="w-full mt-6 flex flex-wrap justify-center gap-2 opacity-0"
            style={{
              animation: 'spark-fade-in 0.6s ease-out forwards',
              animationDelay: '300ms',
            }}
          >
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={goAuth}
                className="px-4 py-2 rounded-full bg-white border border-[#EEEDEB] text-[13px] text-[#555] hover:border-[#FF6B1A] hover:text-[#FF6B1A] transition-colors"
              >
                {prompt}
              </button>
            ))}
          </section>

          {/* 4. Capabilities */}
          <section
            className="w-full mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 opacity-0"
            style={{
              animation: 'spark-fade-in 0.6s ease-out forwards',
              animationDelay: '450ms',
            }}
          >
            {CAPABILITIES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="bg-white border border-[#EEEDEB] rounded-xl p-5 hover:border-[#FFCBA8] hover:shadow-sm transition-all"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: 'rgba(255, 107, 26, 0.1)' }}
                >
                  <Icon size={18} className="text-[#FF6B1A]" />
                </div>
                <h3 className="text-[15px] font-semibold text-[#1F1F1F] mb-1.5">
                  {title}
                </h3>
                <p className="text-[13px] text-[#888] leading-relaxed">{desc}</p>
              </div>
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
              onClick={goAuth}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-white font-medium spark-shadow hover:opacity-95 hover:scale-[1.02] transition-all"
              style={{ background: 'linear-gradient(135deg, #FF8C42, #FF6B1A)' }}
            >
              立即开始
              <ArrowRight size={16} />
            </button>
          </section>
        </div>
      </main>

      <footer className="text-center text-[12px] text-[#BBB] py-6">
        © 2026 火花 Spark · AI 驱动的新媒体营销引擎
      </footer>
    </div>
  );
}
