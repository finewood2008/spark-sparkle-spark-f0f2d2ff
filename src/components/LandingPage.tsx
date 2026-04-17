import { useEffect, useState } from 'react';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { Send } from 'lucide-react';
import SparkLogo from './SparkLogo';

const TYPING_PHRASES = [
  '告诉火花你想做什么...',
  '帮我写一篇小红书种草笔记',
  '每周自动帮我生成内容并发布',
];

const QUICK_LINKS = ['内容创作', '自动排期', '数据分析'];

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
  const router = useRouter();
  const placeholder = useTypewriter(TYPING_PHRASES);

  // 预加载 /auth，避免开发模式下首次跳转的瀑布流加载延迟
  useEffect(() => {
    const id = window.setTimeout(() => {
      router.preloadRoute({ to: '/auth' }).catch(() => {});
    }, 300);
    return () => window.clearTimeout(id);
  }, [router]);

  const goAuth = () => navigate({ to: '/auth' });

  return (
    <div className="relative min-h-screen bg-[#FAFAF8] flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-32">
        <div className="w-full max-w-2xl flex flex-col items-center">
          {/* 1. 品牌 */}
          <section
            className="flex flex-col items-center text-center opacity-0"
            style={{
              animation: 'spark-fade-in 0.5s ease-out forwards',
              animationDelay: '0ms',
            }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 spark-shadow"
              style={{ background: 'linear-gradient(135deg, #FF8C42, #FF6B1A)' }}
            >
              <SparkLogo size={26} className="text-white" />
            </div>
            <h1 className="text-[28px] font-bold text-[#1F1F1F] tracking-tight leading-none">
              火花
            </h1>
            <p className="mt-3 text-base text-[#666]">
              你的新媒体 AI 员工
            </p>
          </section>

          {/* 2. 输入框 */}
          <section
            className="w-full max-w-sm sm:max-w-2xl mt-10 opacity-0"
            style={{
              animation: 'spark-fade-in 0.5s ease-out forwards',
              animationDelay: '200ms',
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

          {/* 3. 提示词 */}
          <section
            className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 opacity-0"
            style={{
              animation: 'spark-fade-in 0.5s ease-out forwards',
              animationDelay: '400ms',
            }}
          >
            {QUICK_LINKS.map((link, i) => (
              <div key={link} className="flex items-center gap-x-3">
                <button
                  type="button"
                  onClick={goAuth}
                  className="text-[13px] text-[#999] hover:text-[#FF6B1A] transition-colors"
                >
                  {link}
                </button>
                {i < QUICK_LINKS.length - 1 && (
                  <span className="text-[13px] text-[#DDD]">·</span>
                )}
              </div>
            ))}
          </section>
        </div>
      </main>

      <footer className="flex items-center justify-between px-6 py-5 text-[12px] text-[#CCC]">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={goAuth}
            className="text-[#BBB] hover:text-[#FF6B1A] transition-colors"
          >
            登录
          </button>
          <button
            type="button"
            onClick={goAuth}
            className="text-[#BBB] hover:text-[#FF6B1A] transition-colors"
          >
            注册
          </button>
        </div>
        <div>© 2026 火花 Spark</div>
      </footer>
    </div>
  );
}
