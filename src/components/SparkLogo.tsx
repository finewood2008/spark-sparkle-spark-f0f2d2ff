/**
 * SparkLogo —— 实心火苗剪影 + 右上角小星点
 *
 * 方案 B：参考 Firecrawl 的极简实心火苗剪影（单一封闭路径、纯色填充、
 * 厚重轮廓），同时在右上角增加一颗小四角星，呼应「Spark / 火花」的
 * 命名双关，与 Firecrawl 形成识别度差异。
 *
 * - gradient=true 时使用品牌橘色线性渐变（用于深色/橘色圆底）
 * - gradient=false 时使用 currentColor，由父级颜色继承（如 text-white）
 * - 不再使用中心高光圆点
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
  const fill = gradient ? `url(#${gid})` : 'currentColor';

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
        主体火苗：单一封闭路径
        - 顶端尖头自 (28,6) 起笔，整体略向左偏给右上角星点留位
        - 右侧曲线饱满外扩，底部圆润内收
        - 左侧中段带一个内凹小火苗，营造火焰跳动感
      */}
      <path
        d="
          M 28 6
          C 32 18, 44 24, 46 38
          C 48 50, 40 60, 28 60
          C 16 60, 8 52, 9 41
          C 10 34, 15 30, 18 32
          C 20 33, 20 36, 19 38
          C 18 40, 19 42, 21 42
          C 26 42, 28 36, 26 28
          C 24 20, 26 12, 28 6
          Z
        "
        fill={fill}
      />

      {/*
        右上角小四角星 —— 呼应「Spark / 火花」双关
        以 (52,14) 为中心，四个尖角向外延伸，构成菱形十字星。
        尺寸约为主火苗的 1/4，作为点缀不喧宾夺主。
      */}
      <path
        d="
          M 52 4
          L 54 12
          L 62 14
          L 54 16
          L 52 24
          L 50 16
          L 42 14
          L 50 12
          Z
        "
        fill={fill}
      />
    </svg>
  );
}
