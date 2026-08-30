import { useEffect, useState } from "react";
import "./slot-number.css";

/** 单个数字位：一列 0-9 循环滚动，每次变化至少多转一整圈（老虎机效果） */
function SlotDigit({ digit, delay }: { digit: number; delay: number }) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setOffset((prev) => {
      const cur = prev % 10;
      const delta = (digit - cur + 10) % 10;
      return prev + delta + 10;
    });
  }, [digit]);

  // 数字列长度随目标位移增长，保证滚动范围内始终有足够格子
  const cellCount = 10 * (Math.floor(offset / 10) + 2);

  return (
    <span className="slot-digit">
      <span
        className="slot-col"
        style={{
          transform: `translateY(-${offset}em)`,
          transitionDelay: `${delay}ms`,
        }}
      >
        {Array.from({ length: cellCount }, (_, i) => (
          <span key={i} className="slot-cell">
            {i % 10}
          </span>
        ))}
      </span>
    </span>
  );
}

/** 老虎机滚动数字：每位数字独立滚动，左侧位先停，逐位延迟形成波浪 */
export default function SlotNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const str = value.toLocaleString("en-US");
  return (
    <span className={`slot-number${className ? ` ${className}` : ""}`}>
      {str.split("").map((ch, i) =>
        ch === "," ? (
          <span key={`${str.length}-${i}`} className="slot-sep">
            ,
          </span>
        ) : (
          <SlotDigit key={`${str.length}-${i}`} digit={Number(ch)} delay={i * 70} />
        ),
      )}
    </span>
  );
}
