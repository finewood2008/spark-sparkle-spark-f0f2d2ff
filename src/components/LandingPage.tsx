import { useNavigate } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import SparkLogo from './SparkLogo';

export default function LandingPage() {
  const navigate = useNavigate();

  const goAuth = () => {
    navigate({ to: '/auth' });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAF8] px-6 relative overflow-hidden">
      {/* 极简背景装饰 — 一个大号模糊橘色光晕 */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(255,140,66,0.08) 0%, transparent 70%)',
        }}
      />

      {/* Logo + 品牌名 */}
      <div className="relative flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-200/50 mb-4">
          <SparkLogo size={36} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold text-[#222] tracking-tight">
          火花
        </h1>
        <p className="text-sm text-[#999] mt-1">Spark</p>
      </div>

      {/* 一句话价值主张 */}
      <p className="relative text-[17px] text-[#666] text-center max-w-md leading-relaxed mb-10">
        你的新媒体 AI 员工，帮你写内容、管排期、看数据
      </p>

      {/* CTA 按钮 */}
      <button
        onClick={goAuth}
        className="relative group flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded-full text-[15px] font-medium shadow-lg shadow-orange-200/50 hover:shadow-orange-300/60 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
      >
        开始使用
        <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
      </button>

      {/* 底部版权 */}
      <p className="absolute bottom-6 text-[12px] text-[#CCC]">
        © 2026 火花 Spark
      </p>
    </div>
  );
}
