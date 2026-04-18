/**
 * SparkLogo —— 极简火焰 🔥
 *
 * 单一火焰路径，品牌橘色渐变，无星星装饰。
 * 设计原则：够简洁放在 16px favicon 里也能辨认。
 *
 * - gradient=true  → 品牌橘色渐变 (#FF8C42 → #FF5E1A)
 * - gradient=false → currentColor 单色（跟随父级颜色）
 */
type Props = {
  size?: number;
  className?: string;
  /** 使用品牌橘色渐变填充。false 时用 currentColor */
  gradient?: boolean;
  /** 渐变 id 前缀（同页面多实例避免冲突） */
  idPrefix?: string;
};

export default function SparkLogo({
  size = 28,
  className,
  gradient = false,
  idPrefix = 'spark-logo',
}: Props) {
  const gid = `${idPrefix}-grad`;
  const fill = gradient ? `url(#${gid})` : 'currentColor';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {gradient && (
        <defs>
          <linearGradient id={gid} x1="10" y1="2" x2="22" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF8C42" />
            <stop offset="100%" stopColor="#FF5E1A" />
          </linearGradient>
        </defs>
      )}

      {/*
        火焰主体 — 一笔成型
        外轮廓圆润饱满，左侧中段带内凹小火舌，
        整体向右微倾，表达跃动感。
      */}
      <path
        d="
          M 16 2
          C 16 2, 12 10, 12 14
          C 12 15.5, 13 17, 14 17
          C 14.5 17, 15 16, 14.5 14.5
          C 14 13, 15 11, 16 9
          C 17 11, 22 15, 22 21
          C 22 26.5, 17.5 30, 14 30
          C 8 30, 6 24, 6 20
          C 6 14, 12 8, 16 2
          Z
        "
        fill={fill}
      />
    </svg>
  );
}
