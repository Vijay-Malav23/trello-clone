/** App logo — uses public/favicon.svg */
export default function LogoMark({ size = 28, className = '' }) {
  return (
    <img
      src="/favicon.svg"
      alt=""
      width={size}
      height={size}
      className={`logo-img ${className}`.trim()}
      decoding="async"
    />
  );
}
