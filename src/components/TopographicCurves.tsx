import React from 'react';

export const TopographicCurves: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`absolute top-0 right-0 pointer-events-none overflow-hidden select-none z-0 ${className}`}
      aria-hidden="true"
    >
      <svg
        className="w-[480px] h-[360px] sm:w-[600px] sm:h-[420px] text-stone-200/60"
        viewBox="0 0 600 420"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M650 -40 C520 40, 480 180, 560 320 C600 390, 680 440, 750 480"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <path
          d="M620 -60 C480 30, 430 190, 520 340 C560 410, 640 460, 720 500"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <path
          d="M590 -80 C440 20, 380 200, 480 360 C520 430, 600 480, 690 520"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <path
          d="M560 -100 C400 10, 330 210, 440 380 C480 450, 560 500, 660 540"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <path
          d="M530 -120 C360 0, 280 220, 400 400 C440 470, 520 520, 630 560"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <path
          d="M500 -140 C320 -10, 230 230, 360 420 C400 490, 480 540, 600 580"
          stroke="currentColor"
          strokeWidth="1.2"
        />
      </svg>
    </div>
  );
};
