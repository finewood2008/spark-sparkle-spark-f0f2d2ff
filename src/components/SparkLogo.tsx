/**
 * SparkLogo —— 实心火苗剪影
 *
 * 设计语言参考 Firecrawl：单一封闭路径的火苗轮廓，纯色填充，
 * 底部宽圆、顶部尖、左侧带一个内凹的小火苗，厚重克制。
 * 不使用花瓣、星点或中心高光。
 *
 * - gradient=true 时使用品牌橘色线性渐变（用于深色背景圆底）
 * - gradient=false 时使用 currentColor，由父级颜色继承（如 text-white）
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
          <linearGradient id={gid} x1="20" y1="6" x2="44" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF8C42" />
            <stop offset="100%" stopColor="#FF6B1A" />
          </linearGradient>
        </defs>
      )}

      {/*
        单一封闭路径的火苗：
        - 顶端尖头自 (32,4) 起笔
        - 右侧曲线饱满外扩，底部圆润内收
        - 左侧在中段切入一个内凹小火苗，再回到顶端
        所有控制点经过手调，保证轮廓厚重、对称感稳定。
      */}
      <path
        d="
          M 32 4
          C 36 16, 48 22, 50 36
          C 52 48, 44 58, 32 58
          C 20 58, 12 50, 13 39
          C 14 32, 19 28, 22 30
          C 24 31, 24 34, 23 36
          C 22 38, 23 40, 25 40
          C 30 40, 32 34, 30 26
          C 28 18, 30 10, 32 4
          Z
        "
        fill={gradient ? `url(#${gid})` : 'currentColor'}
      />
    </svg>
  );
}
