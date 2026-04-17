/**
 * SparkLogo —— 抽象火花标识
 *
 * 设计理念：参考 Claude 抽象星芒的语言，把"火花"提炼成
 * 由四片不对称的花瓣/光瓣围绕中心点绽放的几何符号。
 * 既像火苗的跳动，也像 AI 灵感迸发的瞬间。
 *
 * - 不依赖任何图标库
 * - 通过 currentColor 继承父级颜色，便于复用
 * - 支持单色 / 渐变两种模式
 */
type Props = {
  size?: number;
  className?: string;
  /** 是否使用品牌橘色渐变填充。false 时使用 currentColor 单色 */
  gradient?: boolean;
  /** gradient=true 时使用的渐变 id 前缀（同页面多实例避免冲突） */
  idPrefix?: string;
};

export default function SparkLogo({
  size = 28,
  className,
  gradient = false,
  idPrefix = 'spark-logo',
}: Props) {
  const gid = `${idPrefix}-grad`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {gradient && (
        <defs>
          <linearGradient id={gid} x1="12" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFB07A" />
            <stop offset="55%" stopColor="#FF8C42" />
            <stop offset="100%" stopColor="#FF6B1A" />
          </linearGradient>
        </defs>
      )}

      {/*
        四瓣火花：每一瓣都是一个不对称的水滴/叶形，从中心 (32,32) 向外延伸。
        通过两条三次贝塞尔曲线构造尖头花瓣，旋转 0/90/180/270 形成四向绽放。
        主瓣（上 / 下）较长，副瓣（左 / 右）较短，营造跳动的火苗节奏。
      */}
      <g fill={gradient ? `url(#${gid})` : 'currentColor'}>
        {/* 上 — 主瓣 */}
        <path d="M32 4 C 34 18, 38 26, 32 32 C 26 26, 30 18, 32 4 Z" />
        {/* 下 — 主瓣 */}
        <path d="M32 60 C 30 46, 26 38, 32 32 C 38 38, 34 46, 32 60 Z" />
        {/* 右 — 副瓣（略短） */}
        <path d="M60 32 C 48 30, 40 28, 32 32 C 40 36, 48 34, 60 32 Z" opacity="0.92" />
        {/* 左 — 副瓣（略短） */}
        <path d="M4 32 C 16 34, 24 36, 32 32 C 24 28, 16 30, 4 32 Z" opacity="0.92" />
      </g>

      {/* 中心高光圆点 —— 核心能量 */}
      <circle cx="32" cy="32" r="2.4" fill={gradient ? '#FFFFFF' : 'currentColor'} opacity={gradient ? 0.95 : 1} />
    </svg>
  );
}
