/**
 * SparkLogo —— 火花官方 LOGO（多边形低面火苗 + 中央八角星）
 *
 * 直接渲染品牌 LOGO 图片，保持等比缩放。所有调用方继续传 size。
 * 注：旧的 `gradient` / `idPrefix` 参数保留为可选，仅作向后兼容（已无视觉效果）。
 */
import logoUrl from '@/assets/spark-logo.png';

type Props = {
  size?: number;
  className?: string;
  /** @deprecated 保留以兼容旧调用，无视觉效果 */
  gradient?: boolean;
  /** @deprecated 保留以兼容旧调用，无视觉效果 */
  idPrefix?: string;
};

export default function SparkLogo({ size = 28, className }: Props) {
  return (
    <img
      src={logoUrl}
      width={size}
      height={size}
      alt="火花 Spark"
      className={className}
      style={{ objectFit: 'contain', display: 'inline-block' }}
      draggable={false}
    />
  );
}
